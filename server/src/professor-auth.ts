import {
  BadRequestException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { parse } from "./validation";

const lifetime = 8 * 60 * 60 * 1000;
const hash = (value: string) => createHash("sha256").update(value).digest();

@Injectable()
export class ProfessorAuth {
  private readonly passwordHash: Buffer | undefined;
  private readonly hosted =
    process.env.NODE_ENV === "production" || process.env.HOST === "0.0.0.0";
  private readonly secure =
    process.env.APP_ORIGIN?.startsWith("https:") || false;
  private readonly sessions = new Map<string, number>();
  private readonly attempts = new Map<
    string,
    { count: number; expires: number }
  >();

  constructor() {
    const password = process.env.ADMIN_PASSWORD;
    if ((password && password.length < 24) || (this.hosted && !password))
      throw new Error(
        "Hosted professor access requires an ADMIN_PASSWORD of at least 24 characters.",
      );
    if (this.hosted && !this.secure)
      throw new Error("Hosted access requires an HTTPS APP_ORIGIN.");
    if (password) this.passwordHash = hash(password);
  }

  private get cookieName() {
    return this.secure ? "__Host-consultai-professor" : "consultai_professor";
  }

  private token(request: Request) {
    const value = request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${this.cookieName}=`))
      ?.slice(this.cookieName.length + 1);
    return value && /^[A-Za-z0-9_-]{43}$/.test(value)
      ? hash(value).toString("hex")
      : "";
  }

  authenticated(request: Request) {
    if (!this.passwordHash)
      return (
        !this.hosted &&
        ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
          request.socket.remoteAddress || "",
        ) &&
        ["localhost", "127.0.0.1", "[::1]"].includes(request.hostname)
      );
    const token = this.token(request);
    const expires = this.sessions.get(token);
    if (expires && expires > Date.now()) return true;
    if (expires) this.sessions.delete(token);
    return false;
  }

  status(request: Request) {
    return {
      authenticated: this.authenticated(request),
      mode: this.passwordHash ? "password" : "local",
    };
  }

  login(request: Request, response: Response, body: unknown) {
    if (!this.passwordHash)
      throw new BadRequestException("Professor access is local only.");
    const { password } = parse(
      z.object({ password: z.string().min(1).max(512) }),
      body,
    );
    const now = Date.now();
    for (const [key, attempt] of this.attempts)
      if (attempt.expires <= now) this.attempts.delete(key);
    const address = request.ip || request.socket.remoteAddress || "unknown";
    const attempt = this.attempts.get(address) || {
      count: 0,
      expires: now + 300_000,
    };
    if (attempt.count >= 10)
      throw new HttpException(
        "Too many attempts. Try again in five minutes.",
        429,
      );
    if (this.attempts.size >= 1000 && !this.attempts.has(address))
      throw new HttpException("Please try again later.", 429);
    attempt.count++;
    this.attempts.set(address, attempt);
    if (!timingSafeEqual(hash(password), this.passwordHash))
      throw new UnauthorizedException("Incorrect password.");
    this.attempts.delete(address);
    for (const [key, expires] of this.sessions)
      if (expires <= now) this.sessions.delete(key);
    // A new login replaces its previous session and never leaves unbounded state.
    this.sessions.delete(this.token(request));
    if (this.sessions.size >= 64)
      this.sessions.delete(this.sessions.keys().next().value!);
    const token = randomBytes(32).toString("base64url");
    this.sessions.set(hash(token).toString("hex"), now + lifetime);
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: "lax",
      path: "/",
      maxAge: lifetime,
    });
    return { authenticated: true, mode: "password" };
  }

  logout(request: Request, response: Response) {
    this.sessions.delete(this.token(request));
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.secure,
      sameSite: "lax",
      path: "/",
    });
    return {
      authenticated: false,
      mode: this.passwordHash ? "password" : "local",
    };
  }
}
