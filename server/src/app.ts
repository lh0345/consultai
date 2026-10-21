import {
  Body, CanActivate, Catch, Controller, Delete, ExecutionContext, ExceptionFilter,
  ArgumentsHost, ForbiddenException, Get, HttpException, Injectable, Module,
  Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BookingService } from './booking.service';
import { Database } from './database';

@Injectable()
export class LocalAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const address = request.socket.remoteAddress;
    const host = request.hostname;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address || '') || !['localhost', '127.0.0.1', '[::1]'].includes(host)) throw new ForbiddenException('Professor administration is available only on this computer.');
    return true;
  }
}

@Catch()
class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) return response.status(error.getStatus()).json(typeof error.getResponse() === 'string' ? { message: error.message } : error.getResponse());
    // Do not put SQL, credentials, student questions, or provider payloads in responses.
    console.error('API request failed:', error instanceof Error ? error.name : 'Unknown error');
    response.status(500).json({ message: 'Something went wrong. Your details have been kept. Please try again.' });
  }
}

@Controller('api')
class StudentController {
  constructor(private readonly booking: BookingService) {}
  @Get('health') async health() { await this.booking.db.$queryRaw`SELECT 1`; return { status: 'ok', timezone: 'Europe/Skopje' }; }
  @Get('subjects') subjects() { return this.booking.subjects(); }
  @Get('slots') slots(@Query('from') from?: string, @Query('to') to?: string) { return this.booking.slots(from, to); }
  @Post('bookings') book(@Body() body: unknown) { return this.booking.book(body); }
}

@UseGuards(LocalAdminGuard)
@Controller('api/admin')
class ProfessorController {
  constructor(private readonly booking: BookingService) {}
  @Get('overview') overview() { return this.booking.overview(); }
  @Get('bookings') bookings() { return this.booking.bookings(); }
  @Get('slots') slots(@Query('from') from?: string, @Query('to') to?: string) { return this.booking.slots(from, to, true); }
  @Post('slots') createSlot(@Body() body: unknown) { return this.booking.saveSlot(body); }
  @Patch('slots/:id') editSlot(@Param('id') id: string, @Body() body: unknown) { return this.booking.saveSlot(body, id); }
  @Delete('slots/:id') removeSlot(@Param('id') id: string) { return this.booking.removeSlot(id); }
  @Post('subjects') createSubject(@Body() body: unknown) { return this.booking.saveSubject(body); }
  @Patch('subjects/:id') editSubject(@Param('id') id: string, @Body() body: unknown) { return this.booking.saveSubject(body, id); }
}

@Module({ controllers: [StudentController, ProfessorController], providers: [Database, BookingService, LocalAdminGuard] })
class AppModule {}

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn'] });
  app.enableShutdownHooks();
  app.useGlobalFilters(new ApiErrors());
  app.use((request: Request, response: Response, next: () => void) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    if (request.path.startsWith('/api')) response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const expected = process.env.APP_ORIGIN || 'http://localhost:5173';
      const origin = request.headers.origin;
      if ((origin && origin !== expected) || request.headers['sec-fetch-site'] === 'cross-site') return response.status(403).json({ message: 'Requests must come from the ConsultAI app.' });
    }
    next();
  });
  const web = resolve('dist');
  if (existsSync(resolve(web, 'index.html'))) app.useStaticAssets(web);
  return app;
}
