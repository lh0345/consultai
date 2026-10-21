import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response as ExpressResponse } from "express";
import { Database } from "./database";
import type { Booking, Slot, Subject } from "./generated/prisma/client";

const scopes = {
  calendar: ["calendar.events", "calendar.events.freebusy"],
  classroom: [
    "classroom.courses.readonly",
    "classroom.courseworkmaterials.readonly",
    "drive.readonly",
  ],
};
const scopeUrl = (value: string) => `https://www.googleapis.com/auth/${value}`;
class GoogleError extends Error {
  constructor(readonly status: number) {
    super("Google request failed. Reconnect or retry from integrations.");
  }
}

@Injectable()
export class GoogleService {
  constructor(private readonly db: Database) {}
  private states = new Map<
    string,
    { service: "calendar" | "classroom"; expires: number; verifier: string }
  >();
  private access?: { token: string; expires: number };

  configured() {
    return !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI &&
      /^[a-fA-F0-9]{64}$/.test(process.env.TOKEN_ENCRYPTION_KEY || "")
    );
  }
  async connected(service: "calendar" | "classroom") {
    const connection = await this.db.integration.findUnique({
      where: { id: "google" },
    });
    return (
      !!connection &&
      scopes[service].every((scope) =>
        connection.scopes.split(" ").includes(scopeUrl(scope)),
      )
    );
  }
  async status() {
    return {
      demo: process.env.AUTH_MODE === "demo",
      googleConfigured: this.configured(),
      calendar: await this.connected("calendar"),
      classroom: await this.connected("classroom"),
      ai: !!process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    };
  }

  private encrypt(value: string) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex"),
      nonce,
    );
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [nonce, cipher.getAuthTag(), encrypted]
      .map((part) => part.toString("base64url"))
      .join(".");
  }
  private decrypt(value: string) {
    const [nonce, tag, content] = value
      .split(".")
      .map((part) => Buffer.from(part, "base64url"));
    const cipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex"),
      nonce,
    );
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(content), cipher.final()]).toString(
      "utf8",
    );
  }

  begin(service: "calendar" | "classroom", response: ExpressResponse) {
    if (!this.configured())
      throw new ServiceUnavailableException(
        "Add the Google OAuth settings and token encryption key on the server, then restart.",
      );
    for (const [state, info] of this.states)
      if (info.expires < Date.now()) this.states.delete(state);
    if (this.states.size >= 20)
      throw new BadRequestException(
        "Too many connection attempts. Try again in a few minutes.",
      );
    const state = randomBytes(32).toString("hex");
    const verifier = randomBytes(48).toString("base64url");
    this.states.set(state, {
      service,
      expires: Date.now() + 600_000,
      verifier,
    });
    response.cookie("consultai_oauth", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_ORIGIN?.startsWith("https:"),
      maxAge: 600_000,
      path: "/api/admin/integrations/google",
    });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for (const [key, value] of Object.entries({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      response_type: "code",
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
      scope: scopes[service].map(scopeUrl).join(" "),
    }))
      url.searchParams.set(key, value);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set(
      "code_challenge",
      createHash("sha256").update(verifier).digest("base64url"),
    );
    return { url: url.toString() };
  }

  async callback(request: Request) {
    const state =
      typeof request.query.state === "string" ? request.query.state : "";
    const cookie =
      request.headers.cookie
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("consultai_oauth="))
        ?.slice(16) || "";
    const info = this.states.get(state);
    this.states.delete(state);
    if (
      !info ||
      info.expires < Date.now() ||
      !state ||
      cookie.length !== state.length ||
      !timingSafeEqual(Buffer.from(cookie), Buffer.from(state))
    )
      throw new BadRequestException(
        "This connection request expired. Please start again.",
      );
    if (request.query.error || typeof request.query.code !== "string")
      return { service: info.service, result: "declined" };
    const token = await this.tokenRequest({
      code: request.query.code,
      code_verifier: info.verifier,
      grant_type: "authorization_code",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    });
    const refreshToken = token.refresh_token
      ? this.encrypt(token.refresh_token)
      : undefined;
    if (!refreshToken)
      throw new ServiceUnavailableException(
        "Google did not grant offline access. Reconnect and grant the requested permissions.",
      );
    const granted = token.scope || "";
    if (
      !scopes[info.service].every((scope) =>
        granted.split(" ").includes(scopeUrl(scope)),
      )
    )
      return { service: info.service, result: "declined" };
    await this.db.integration.upsert({
      where: { id: "google" },
      create: { id: "google", refreshToken, scopes: granted },
      update: { refreshToken, scopes: granted },
    });
    this.access = undefined;
    return { service: info.service, result: "connected" };
  }

  private async tokenRequest(parameters: Record<string, string>): Promise<{
    access_token: string;
    expires_in: number;
    scope?: string;
    refresh_token?: string;
  }> {
    if (!this.configured())
      throw new ServiceUnavailableException(
        "Google is not configured on this server.",
      );
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          ...parameters,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new GoogleError(response.status);
      const result = await response.json();
      if (typeof result.access_token !== "string") throw new GoogleError(502);
      return result;
    } catch {
      throw new ServiceUnavailableException(
        "Could not authorize with Google. Check the connection in integrations.",
      );
    }
  }

  private async accessToken() {
    if (this.access && this.access.expires > Date.now())
      return this.access.token;
    const connection = await this.db.integration.findUnique({
      where: { id: "google" },
    });
    if (!connection)
      throw new ServiceUnavailableException(
        "Connect your Google account first.",
      );
    let refreshToken: string;
    try {
      refreshToken = this.decrypt(connection.refreshToken);
    } catch {
      throw new ServiceUnavailableException(
        "Google token could not be read. Restore the encryption key or reconnect.",
      );
    }
    const token = await this.tokenRequest({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    this.access = {
      token: token.access_token,
      expires: Date.now() + (token.expires_in - 60) * 1000,
    };
    return token.access_token;
  }

  async request(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.accessToken();
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new GoogleError(response.status);
      return response;
    } catch (error) {
      if (error instanceof GoogleError) throw error;
      throw new ServiceUnavailableException(
        "Google did not respond. Please retry shortly.",
      );
    }
  }

  async busy(slots: Slot[]) {
    if (!slots.length || !(await this.connected("calendar")))
      return [] as { start: string; end: string }[];
    try {
      const response = await this.request(
        "https://www.googleapis.com/calendar/v3/freeBusy",
        {
          method: "POST",
          body: JSON.stringify({
            timeMin: slots[0].startsAt.toISOString(),
            timeMax: slots
              .reduce(
                (max, slot) => (slot.endsAt > max ? slot.endsAt : max),
                slots[0].endsAt,
              )
              .toISOString(),
            timeZone: "Europe/Skopje",
            items: [{ id: "primary" }],
          }),
        },
      );
      const data = await response.json();
      if (
        !data.calendars?.primary ||
        data.calendars.primary.errors?.length ||
        !Array.isArray(data.calendars.primary.busy)
      )
        throw new GoogleError(502);
      return data.calendars.primary.busy as { start: string; end: string }[];
    } catch {
      throw new ServiceUnavailableException(
        "Calendar availability could not be checked. Please try again shortly.",
      );
    }
  }

  async sync(booking: Booking & { slot: Slot; subject: Subject }) {
    if (!(await this.connected("calendar"))) return booking;
    const eventId = `c${booking.id.replaceAll("-", "")}`;
    await this.db.booking.update({
      where: { id: booking.id },
      data: { calendarStatus: "pending" },
    });
    try {
      try {
        await this.request(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",
          {
            method: "POST",
            body: JSON.stringify({
              id: eventId,
              summary: `${booking.subject.name} · ${booking.name}`,
              description: `${booking.name}\n${booking.email}\n\n${booking.question}`,
              start: {
                dateTime: booking.slot.startsAt.toISOString(),
                timeZone: "Europe/Skopje",
              },
              end: {
                dateTime: booking.slot.endsAt.toISOString(),
                timeZone: "Europe/Skopje",
              },
              extendedProperties: { private: { consultaiBooking: booking.id } },
            }),
          },
        );
      } catch (error) {
        if (!(error instanceof GoogleError) || error.status !== 409)
          throw error;
        const existing = await (
          await this.request(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
          )
        ).json();
        if (
          existing.extendedProperties?.private?.consultaiBooking !==
            booking.id ||
          existing.status === "cancelled"
        )
          throw new ConflictException("Calendar event needs review.");
      }
      return await this.db.booking.update({
        where: { id: booking.id },
        data: { calendarStatus: "synced", calendarEventId: eventId },
        include: { slot: true, subject: true },
      });
    } catch {
      return this.db.booking.update({
        where: { id: booking.id },
        data: { calendarStatus: "failed" },
        include: { slot: true, subject: true },
      });
    }
  }
}
