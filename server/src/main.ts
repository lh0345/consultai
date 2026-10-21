import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller('api')
class HealthController {
  @Get('health') health() { return { status: 'ok', timezone: 'Europe/Skopje' }; }
}
@Module({ controllers: [HealthController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), '127.0.0.1');
  console.log(`ConsultAI API ready at http://localhost:${process.env.PORT || 3001}`);
}
void bootstrap();
