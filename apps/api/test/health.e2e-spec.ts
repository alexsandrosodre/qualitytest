import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_PREFIX } from '@qualitytest/shared';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from './prisma-mock';

describe('Health (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const prisma: PrismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('expõe GET /health sem exigir autenticação (uso por probes)', async () => {
    const response = await request(server).get(`/${API_PREFIX}/health`).expect(200);

    expect(response.body).toMatchObject({
      service: 'qualitytest-api',
      status: expect.stringMatching(/^(ok|degraded)$/),
    });
    expect(response.body.checks).toHaveProperty('database');
  });

  it('mantém rotas de negócio protegidas quando não há token (401)', async () => {
    await request(server).get(`/${API_PREFIX}/projects`).expect(401);
  });
});
