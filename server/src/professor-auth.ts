import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { parse } from "./validation";

const lifetime = 8 * 60 * 60 * 1000;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

// These are explicitly demo Google identities and a demo Classroom course.
// Roles are derived from course ownership, never accepted from the browser.
export const demoAccounts = [
  { id: "demo-jane", name: "Jane Doe", email: "jane.doe@example.edu" },
  { id: "demo-alex", name: "Alex Morgan", email: "alex.morgan@example.edu" },
] as const;
export const demoCourse = {
  id: "demo-classroom-cs101",
  name: "Data Structures",
  ownerId: "demo-alex",
};

@Injectable()
export class ProfessorAuth {
  private readonly hosted =
    process.env.NODE_ENV === "production" || process.env.HOST === "0.0.0.0";
  private readonly secure =
    process.env.APP_ORIGIN?.startsWith("https:") || false;
  private readonly sessions = new Map<
    string,
    { accountId: string; expires: number }
  >();

  constructor() {
    if (this.hosted && (process.env.AUTH_MODE !== "demo" || !this.secure))
      throw new Error(
        "Hosted demo access requires AUTH_MODE=demo and an HTTPS APP_ORIGIN.",
      );
    if (
      this.hosted &&
      (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET)
    )
      throw new Error(
        "Public demo accounts cannot be combined with live Google credentials.",
      );
  }

  private get cookieName() {
    return this.secure ? "__Host-consultai-session" : "consultai_session";
  }

  private token(request: Request) {
    const value = request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(this.cookieName + "="))
      ?.slice(this.cookieName.length + 1);
    return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? hash(value) : "";
  }

  private account(request: Request) {
    const token = this.token(request);
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expires <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return (
      demoAccounts.find((account) => account.id === session.accountId) || null
    );
  }

  private role(accountId: string) {
    return accountId === demoCourse.ownerId
      ? ("professor" as const)
      : ("student" as const);
  }

  authenticated(request: Request) {
    const account = this.account(request);
    return !!account && this.role(account.id) === "professor";
  }

  status(request: Request) {
    return this.view(this.account(request));
  }

  private view(profile: (typeof demoAccounts)[number] | null) {
    return {
      profile,
      role: profile ? this.role(profile.id) : null,
      demo: true as const,
      accounts: demoAccounts.map((account) => ({
        ...account,
        role: this.role(account.id),
      })),
    };
  }

  login(request: Request, response: Response, body: unknown) {
    const { accountId } = parse(
      z.strictObject({ accountId: z.string().max(100) }),
      body,
    );
    const account = demoAccounts.find((value) => value.id === accountId);
    if (!account)
      throw new BadRequestException("Choose a demo Google account.");
    const now = Date.now();
    for (const [key, session] of this.sessions)
      if (session.expires <= now) this.sessions.delete(key);
    this.sessions.delete(this.token(request));
    if (this.sessions.size >= 1000)
      this.sessions.delete(this.sessions.keys().next().value!);
    const token = randomBytes(32).toString("base64url");
    this.sessions.set(hash(token), {
      accountId: account.id,
      expires: now + lifetime,
    });
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: "lax",
      path: "/",
      maxAge: lifetime,
    });
    return this.view(account);
  }

  logout(request: Request, response: Response) {
    this.sessions.delete(this.token(request));
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.secure,
      sameSite: "lax",
      path: "/",
    });
    return this.view(null);
  }
}
