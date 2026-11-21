import 'reflect-metadata';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX, API_VERSION } from '@qualitytest/shared';

import { AppModule } from './app.module';
import { applyDatabaseUrlFallback } from './common/config/database-url';
import { applySecurity } from './common/security/security.middleware';

export async function createApiApp(): Promise<INestApplication> {
  applyDatabaseUrlFallback();

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

  applySecurity(app);

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

  await app.init();
  return app;
}
