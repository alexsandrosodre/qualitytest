import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@qualitytest/shared';
import type { Server } from 'node:http';
import request from 'supertest';

import { applySecurity, resolveCorsOrigins } from './security.middleware';

@Controller('ping')
class PingController {
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [PingController] })
class TestAppModule {}

describe('resolveCorsOrigins', () => {
  it('usa o padrão de desenvolvimento quando ausente', () => {
    const saved = process.env.CORS_ORIGIN;
    delete process.env.CORS_ORIGIN;
    try {
      expect(resolveCorsOrigins()).toEqual(['http://localhost:3000']);
    } finally {
      if (saved !== undefined) {
        process.env.CORS_ORIGIN = saved;
      }
    }
  });

  it('faz o split por vírgula e remove espaços em branco', () => {
    expect(resolveCorsOrigins('http://a.com, http://b.com')).toEqual([
      'http://a.com',
      'http://b.com',
    ]);
  });

  it('descarta entradas vazias', () => {
    expect(resolveCorsOrigins(' , http://a.com , ')).toEqual(['http://a.com']);
  });
});

describe('applySecurity', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    app = await NestFactory.create(TestAppModule, { logger: false });
    app.setGlobalPrefix(API_PREFIX);
    applySecurity(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('aplica headers de segurança do helmet nas rotas da API', async () => {
    const res = await request(server).get(`/${API_PREFIX}/ping`);

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    // O header que revela a stack deve ser removido.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('relaxa o CSP apenas na rota de documentação (Swagger)', async () => {
    const res = await request(server).get(`/${API_PREFIX}/docs`);

    expect(res.headers['content-security-policy']).toContain("'unsafe-inline'");
  });

  it('respeita a whitelist de CORS para a origem de desenvolvimento', async () => {
    const res = await request(server)
      .get(`/${API_PREFIX}/ping`)
      .set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
