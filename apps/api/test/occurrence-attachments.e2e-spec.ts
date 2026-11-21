import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  GlobalRole,
  OccurrenceCategory,
  OccurrencePriority,
  ProjectRole,
} from '@prisma/client';
import { API_PREFIX } from '@qualitytest/shared';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/common/password/password.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from './prisma-mock';

const PASSWORD = 'Senha@12345';
const BASE = `/${API_PREFIX}/occurrences`;

describe('Anexos de ocorrências (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaMock;

  let projectId: string;
  let gestorToken: string;
  let testerToken: string;
  let outsiderToken: string;

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(PASSWORD);
    prisma = createPrismaMock();

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

    prisma.seedUser({
      name: 'Admin',
      email: 'admin@test.local',
      passwordHash,
      globalRole: GlobalRole.ADMINISTRADOR,
    });
    const gestor = prisma.seedUser({ name: 'Gestor', email: 'gestor@test.local', passwordHash });
    const tester = prisma.seedUser({ name: 'Tester', email: 'tester@test.local', passwordHash });
    prisma.seedUser({ name: 'Outsider', email: 'outsider@test.local', passwordHash });

    const project = prisma.seedProject({ name: 'Projeto', code: 'PROJ' });
    projectId = project.id;

    prisma.seedMember({ projectId: project.id, userId: gestor.id, role: ProjectRole.GESTOR });
    prisma.seedMember({ projectId: project.id, userId: tester.id, role: ProjectRole.TESTADOR });

    gestorToken = await login('gestor@test.local');
    testerToken = await login('tester@test.local');
    outsiderToken = await login('outsider@test.local');
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await request(server)
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function createOccurrence(token: string, key: string): Promise<string> {
    const res = await request(server)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({
        projectId,
        title: 'Falha com evidência',
        categoryId: OccurrenceCategory.ERRO_FUNCIONAL,
        priority: OccurrencePriority.MEDIA,
      })
      .expect(201);
    return res.body.id as string;
  }

  function attachmentBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { fileName: 'screenshot.png', mimeType: 'image/png', size: 204_800, ...overrides };
  }

  /* ------------------------------ Registro -------------------------------- */

  describe('POST /occurrences/:id/attachments', () => {
    it('exige autenticação (401)', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-401');
      await request(server).post(`${BASE}/${id}/attachments`).send(attachmentBody()).expect(401);
    });

    it('usuário sem vínculo recebe 403', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-403');
      await request(server)
        .post(`${BASE}/${id}/attachments`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send(attachmentBody())
        .expect(403);
    });

    it('rejeita tipo MIME não permitido (422)', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-mime');
      await request(server)
        .post(`${BASE}/${id}/attachments`)
        .set('Authorization', `Bearer ${testerToken}`)
        .send(attachmentBody({ mimeType: 'application/x-msdownload' }))
        .expect(422);
    });

    it('rejeita extensão incompatível com o tipo MIME (422)', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-ext');
      await request(server)
        .post(`${BASE}/${id}/attachments`)
        .set('Authorization', `Bearer ${testerToken}`)
        .send(attachmentBody({ fileName: 'malicioso.exe', mimeType: 'image/png' }))
        .expect(422);
    });

    it('rejeita anexo acima do tamanho máximo (422)', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-size');
      await request(server)
        .post(`${BASE}/${id}/attachments`)
        .set('Authorization', `Bearer ${testerToken}`)
        .send(attachmentBody({ size: 11 * 1024 * 1024 }))
        .expect(422);
    });

    it('registra o anexo e devolve URL assinada de upload (201)', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-ok');

      const res = await request(server)
        .post(`${BASE}/${id}/attachments`)
        .set('Authorization', `Bearer ${testerToken}`)
        .send(attachmentBody())
        .expect(201);

      expect(res.body.fileName).toBe('screenshot.png');
      expect(res.body.mimeType).toBe('image/png');
      expect(res.body.storageKey).toBeDefined();
      expect(String(res.body.uploadUrl)).toContain('memory://upload/');
      expect(res.body.expiresInSeconds).toBeGreaterThan(0);

      const history = prisma.state.history.find(
        (entry) => entry.occurrenceId === id && entry.action === 'ATTACHMENT_ADDED',
      );
      expect(history?.newValue).toBe(res.body.id);

      const audit = prisma.state.auditLogs.find(
        (log) => log.action === 'OCCURRENCE_ATTACHMENT_ADDED' && log.entityId === id,
      );
      expect(audit).toBeDefined();
    });
  });

  /* ------------------------------ Listagem -------------------------------- */

  describe('GET /occurrences/:id/attachments', () => {
    it('lista os anexos da ocorrência (200)', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-list');

      await request(server)
        .post(`${BASE}/${id}/attachments`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .send(attachmentBody({ fileName: 'evidencia.pdf', mimeType: 'application/pdf' }))
        .expect(201);

      const res = await request(server)
        .get(`${BASE}/${id}/attachments`)
        .set('Authorization', `Bearer ${testerToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].fileName).toBe('evidencia.pdf');
    });
  });

  /* ------------------------------ Download -------------------------------- */

  describe('GET /occurrences/:id/attachments/:attachmentId/url', () => {
    it('gera URL assinada de download (200)', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-download');

      const created = await request(server)
        .post(`${BASE}/${id}/attachments`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .send(attachmentBody())
        .expect(201);

      const res = await request(server)
        .get(`${BASE}/${id}/attachments/${created.body.id}/url`)
        .set('Authorization', `Bearer ${testerToken}`)
        .expect(200);

      expect(String(res.body.downloadUrl)).toContain('memory://download/');
      expect(res.body.expiresInSeconds).toBeGreaterThan(0);
    });

    it('retorna 404 para anexo inexistente', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-download-404');
      await request(server)
        .get(`${BASE}/${id}/attachments/inexistente/url`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .expect(404);
    });
  });

  /* ------------------------------ Remoção --------------------------------- */

  describe('DELETE /occurrences/:id/attachments/:attachmentId', () => {
    it('membro não autor nem privilegiado recebe 403', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-del-403');

      const created = await request(server)
        .post(`${BASE}/${id}/attachments`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .send(attachmentBody())
        .expect(201);

      await request(server)
        .delete(`${BASE}/${id}/attachments/${created.body.id}`)
        .set('Authorization', `Bearer ${testerToken}`)
        .expect(403);
    });

    it('o autor remove o próprio anexo (204)', async () => {
      const id = await createOccurrence(gestorToken, 'k-att-del-ok');

      const created = await request(server)
        .post(`${BASE}/${id}/attachments`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .send(attachmentBody())
        .expect(201);

      await request(server)
        .delete(`${BASE}/${id}/attachments/${created.body.id}`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .expect(204);

      expect(
        prisma.state.attachments.some((attachment) => attachment.id === created.body.id),
      ).toBe(false);
    });
  });
});
