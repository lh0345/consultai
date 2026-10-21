import {
  Body,
  CanActivate,
  Catch,
  Controller,
  Delete,
  ExecutionContext,
  ExceptionFilter,
  ArgumentsHost,
  ForbiddenException,
  Get,
  HttpException,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UnauthorizedException,
  Req,
  Res,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { BookingService } from "./booking.service";
import { Database } from "./database";
import { GoogleService } from "./google.service";
import { StudyService } from "./study.service";
import { ClassroomService } from "./classroom.service";
import { parse, uuid } from "./validation";
import { z } from "zod";
import { ProfessorAuth } from "./professor-auth";

@Injectable()
export class ProfessorGuard implements CanActivate {
  constructor(private readonly auth: ProfessorAuth) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!this.auth.authenticated(request))
      throw new UnauthorizedException("Sign in to the professor workspace.");
    return true;
  }
}

@Controller("api/auth/professor")
class ProfessorAuthController {
  constructor(private readonly auth: ProfessorAuth) {}
  @Get() status(@Req() request: Request) {
    return this.auth.status(request);
  }
  @Post() login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.auth.login(request, response, body);
  }
  @Post("logout") logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.logout(request, response);
  }
}

@Catch()
class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException)
      return response
        .status(error.getStatus())
        .json(
          typeof error.getResponse() === "string"
            ? { message: error.message }
            : error.getResponse(),
        );
    // Do not put SQL, credentials, student questions, or provider payloads in responses.
    console.error(
      "API request failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    response.status(500).json({
      message:
        "Something went wrong. Your details have been kept. Please try again.",
    });
  }
}

@Controller("api")
class StudentController {
  constructor(
    private readonly booking: BookingService,
    private readonly study: StudyService,
  ) {}
  @Get("health") async health() {
    await this.booking.db.$queryRaw`SELECT 1`;
    return { status: "ok", timezone: "Europe/Skopje" };
  }
  @Get("subjects") subjects() {
    return this.booking.subjects();
  }
  @Get("capabilities") capabilities() {
    return { ai: !!process.env.GEMINI_API_KEY };
  }
  @Get("slots") slots(@Query("from") from?: string, @Query("to") to?: string) {
    return this.booking.slots(from, to);
  }
  @Post("bookings") book(@Body() body: unknown) {
    return this.booking.book(body);
  }
  @Get("subjects/:id/materials") materials(@Param("id") id: string) {
    return this.study.materials(id);
  }
  @Post("ai") ask(@Body() body: unknown) {
    return this.study.ask(body);
  }
}

@UseGuards(ProfessorGuard)
@Controller("api/admin")
class ProfessorController {
  constructor(
    private readonly booking: BookingService,
    private readonly google: GoogleService,
    private readonly study: StudyService,
    private readonly classroom: ClassroomService,
  ) {}
  @Get("classroom/courses") classroomCourses() {
    return this.classroom.courses();
  }
  @Post("classroom/courses") importCourse(@Body() body: unknown) {
    return this.classroom.importCourse(body);
  }
  @Post("classroom/materials") importMaterials(@Body() body: unknown) {
    return this.classroom.importMaterials(body);
  }
  @Post("materials/:id/drive") loadDrive(@Param("id") id: string) {
    return this.classroom.loadText(id);
  }
  @Get("materials") materials() {
    return this.study.adminMaterials();
  }
  @Post("materials") createMaterial(@Body() body: unknown) {
    return this.study.saveMaterial(body);
  }
  @Patch("materials/:id") editMaterial(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.study.saveMaterial(body, id);
  }
  @Patch("materials/:id/approval") approve(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.study.approve(id, body);
  }
  @Get("integrations") integrations() {
    return this.google.status();
  }
  @Post("integrations/google/connect") connect(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.google.begin(
      parse(
        z.strictObject({ service: z.enum(["calendar", "classroom"]) }),
        body,
      ).service,
      response,
    );
  }
  @Get("integrations/google/callback") async callback(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    try {
      const result = await this.google.callback(request);
      return response.redirect(
        `${process.env.APP_ORIGIN || "http://localhost:5173"}/#/professor/${result.service}?google=${result.result}`,
      );
    } catch {
      return response.redirect(
        `${process.env.APP_ORIGIN || "http://localhost:5173"}/#/professor/calendar?google=failed`,
      );
    }
  }
  @Get("calendar-sync") calendarSync() {
    return this.booking.db.booking.findMany({
      where: { calendarStatus: { in: ["pending", "failed"] } },
      include: { slot: true, subject: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
  @Post("bookings/:id/calendar") async retryCalendar(@Param("id") id: string) {
    if (!(await this.google.connected("calendar")))
      throw new ForbiddenException("Connect Google Calendar first.");
    const booking = await this.booking.db.booking.findUnique({
      where: { id: parse(uuid, id) },
      include: { slot: true, subject: true },
    });
    if (!booking) throw new HttpException("Booking not found.", 404);
    return this.google.sync(booking);
  }
  @Get("overview") overview() {
    return this.booking.overview();
  }
  @Get("bookings") bookings() {
    return this.booking.bookings();
  }
  @Get("slots") slots(@Query("from") from?: string, @Query("to") to?: string) {
    return this.booking.slots(from, to, true);
  }
  @Post("slots") createSlot(@Body() body: unknown) {
    return this.booking.saveSlot(body);
  }
  @Patch("slots/:id") editSlot(@Param("id") id: string, @Body() body: unknown) {
    return this.booking.saveSlot(body, id);
  }
  @Delete("slots/:id") removeSlot(@Param("id") id: string) {
    return this.booking.removeSlot(id);
  }
  @Post("subjects") createSubject(@Body() body: unknown) {
    return this.booking.saveSubject(body);
  }
  @Patch("subjects/:id") editSubject(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.booking.saveSubject(body, id);
  }
}

@Module({
  controllers: [
    StudentController,
    ProfessorController,
    ProfessorAuthController,
  ],
  providers: [
    Database,
    BookingService,
    GoogleService,
    StudyService,
    ClassroomService,
    ProfessorGuard,
    ProfessorAuth,
  ],
})
class AppModule {}

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn"],
  });
  app.enableShutdownHooks();
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.useBodyParser("json", { limit: "256kb" });
  app.useGlobalFilters(new ApiErrors());
  app.use((request: Request, response: Response, next: () => void) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("X-Frame-Options", "DENY");
    if (request.path.startsWith("/api"))
      response.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const expected = process.env.APP_ORIGIN || "http://localhost:5173";
      const allowed = new Set([expected]);
      const alias = new URL(expected);
      if (["localhost", "127.0.0.1"].includes(alias.hostname)) {
        alias.hostname =
          alias.hostname === "localhost" ? "127.0.0.1" : "localhost";
        allowed.add(alias.origin);
      }
      const origin = request.headers.origin;
      if (
        (origin && !allowed.has(origin)) ||
        request.headers["sec-fetch-site"] === "cross-site"
      )
        return response
          .status(403)
          .json({ message: "Requests must come from the ConsultAI app." });
    }
    next();
  });
  const web = resolve("dist");
  if (existsSync(resolve(web, "index.html"))) app.useStaticAssets(web);
  return app;
}
