import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX, API_VERSION } from '@qualitytest/shared';

import { AppModule } from './app.module';

function resolveCorsOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function resolvePort(): number {
  const parsed = Number.parseInt(process.env.API_PORT ?? '3333', 10);
  return Number.isNaN(parsed) ? 3333 : parsed;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const corsOrigins = resolveCorsOrigins();
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('QUALITY TEST API')
    .setDescription(
      'API REST da plataforma corporativa QUALITY TEST. ' +
        'Toda operação dependente de projeto valida o vínculo (ProjectMember) do usuário autenticado.',
    )
    .setVersion(API_VERSION)
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, swaggerDocument);

  const port = resolvePort();
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API disponível em http://localhost:${port}/${API_PREFIX}`);
  logger.log(`Swagger disponível em http://localhost:${port}/${API_PREFIX}/docs`);
  logger.log(`CORS liberado para: ${corsOrigins.join(', ')}`);
}

bootstrap().catch((error: unknown) => {
  const message: string = error instanceof Error ? error.message : String(error);
  console.error(`Falha ao iniciar a API: ${message}`);
  process.exit(1);
});
