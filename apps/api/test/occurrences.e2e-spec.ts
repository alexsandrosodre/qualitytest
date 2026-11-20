import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  GlobalRole,
  OccurrenceCategory,
  OccurrencePriority,
  OccurrenceStatus,
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

interface LoginTokens {
  admin: string;
  gestor: string;
  tester: string;
  dev: string;
  outsider: string;
}

describe('Ocorrências (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaMock;
  let passwordHash: string;

  let projectAId: string;
  let projectBId: string;
  let environmentAId: string;
  let outsourcedEnvironmentId: string;
  let tokens: LoginTokens;
  let outsiderUserId: string;

  beforeAll(async () => {
    passwordHash = await new PasswordService().hash(PASSWORD);
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
    const dev = prisma.seedUser({ name: 'Dev', email: 'dev@test.local', passwordHash });
    const outsider = prisma.seedUser({
      name: 'Outsider',
      email: 'outsider@test.local',
      passwordHash,
    });
    outsiderUserId = outsider.id;

    const projectA = prisma.seedProject({ name: 'Projeto A', code: 'PROJA' });
    const projectB = prisma.seedProject({ name: 'Projeto B', code: 'PROJB' });
    projectAId = projectA.id;
    projectBId = projectB.id;

    prisma.seedMember({ projectId: projectA.id, userId: gestor.id, role: ProjectRole.GESTOR });
    prisma.seedMember({ projectId: projectA.id, userId: tester.id, role: ProjectRole.TESTADOR });
    prisma.seedMember({ projectId: projectA.id, userId: dev.id, role: ProjectRole.DESENVOLVEDOR });

    const environmentA = prisma.seedEnvironment({
      projectId: projectA.id,
      name: 'Homologação',
      baseUrl: 'https://homolog.example.invalid',
    });
    environmentAId = environmentA.id;
    const environmentB = prisma.seedEnvironment({
      projectId: projectB.id,
      name: 'Produção B',
      baseUrl: 'https://prod.example.invalid',
    });
    outsourcedEnvironmentId = environmentB.id;

    tokens = {
      admin: await login('admin@test.local'),
      gestor: await login('gestor@test.local'),
      tester: await login('tester@test.local'),
      dev: await login('dev@test.local'),
      outsider: await login('outsider@test.local'),
    };
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

  function createBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      projectId: projectAId,
      title: 'Componente desalinhado',
      description: 'Botão fora da área visível.',
      categoryId: OccurrenceCategory.ERRO_VISUAL,
      priority: OccurrencePriority.ALTA,
      environmentId: environmentAId,
      ...overrides,
    };
  }

  /* ------------------------------- Criação -------------------------------- */

  describe('POST /occurrences', () => {
    it('exige autenticação (401)', async () => {
      await request(server).post(BASE).set('Idempotency-Key', 'k-1').send(createBody()).expect(401);
    });

    it('exige o header Idempotency-Key (400)', async () => {
      await request(server)
        .post(BASE)
        .set('Authorization', `Bearer ${tokens.tester}`)
        .send(createBody())
        .expect(400);
    });

    it('rejeita reporterUserId/userId no corpo (400)', async () => {
      await request(server)
        .post(BASE)
        .set('Authorization', `Bearer ${tokens.tester}`)
        .set('Idempotency-Key', 'k-reporter')
        .send(createBody({ reporterUserId: outsiderUserId }))
        .expect(400);
    });

    it('usuário sem vínculo recebe 403', async () => {
      await request(server)
        .post(BASE)
        .set('Authorization', `Bearer ${tokens.outsider}`)
        .set('Idempotency-Key', 'k-outsider')
        .send(createBody())
        .expect(403);
    });

    it('ambiente de outro projeto é rejeitado (400)', async () => {
      await request(server)
        .post(BASE)
        .set('Authorization', `Bearer ${tokens.tester}`)
        .set('Idempotency-Key', 'k-bad-env')
        .send(createBody({ environmentId: outsourcedEnvironmentId }))
        .expect(400);
    });

    it('cria a ocorrência atribuindo o autor pelo servidor (201)', async () => {
      const res = await request(server)
        .post(BASE)
        .set('Authorization', `Bearer ${tokens.tester}`)
        .set('Idempotency-Key', 'k-create-1')
        .send(createBody())
        .expect(201);

      expect(res.body.publicCode).toMatch(/^QT-\d{6}$/);
      expect(res.body.status).toBe(OccurrenceStatus.ABERTO);
      expect(res.body.reporterUserId).toBeDefined();
      expect(res.body.reporterUserId).not.toBe(outsiderUserId);
      expect(res.body.project.id).toBe(projectAId);
      expect(res.body.history).toHaveLength(1);
      expect(res.body.history[0].action).toBe('CREATED');

      const audit = prisma.state.auditLogs.find(
        (log) => log.action === 'OCCURRENCE_CREATED' && log.entityId === res.body.id,
      );
      expect(audit).toBeDefined();
    });

    it('reenvio com a mesma Idempotency-Key devolve a mesma ocorrência (200)', async () => {
      const first = await request(server)
        .post(BASE)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .set('Idempotency-Key', 'k-idem-1')
        .send(createBody({ title: 'Idempotente' }))
        .expect(201);

      const second = await request(server)
        .post(BASE)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .set('Idempotency-Key', 'k-idem-1')
        .send(createBody({ title: 'Idempotente' }))
        .expect(200);

      expect(second.body.id).toBe(first.body.id);
      expect(prisma.state.occurrences.filter((o) => o.idempotencyKey === 'k-idem-1')).toHaveLength(1);
    });
  });

  /* ------------------------------- Listagem ------------------------------- */

  describe('GET /occurrences', () => {
    beforeAll(() => {
      // Ocorrências de projetos distintos para provar o isolamento.
      prisma.seedOccurrence({
        projectId: projectBId,
        reporterUserId: outsiderUserId,
        title: 'Somente projeto B',
        status: OccurrenceStatus.ABERTO,
      });
    });

    it('usuário sem vínculo no projeto recebe 403', async () => {
      await request(server)
        .get(`${BASE}?projectId=${projectAId}`)
        .set('Authorization', `Bearer ${tokens.outsider}`)
        .expect(403);
    });

    it('isola os dados por projeto (não retorna ocorrências de outro projeto)', async () => {
      const res = await request(server)
        .get(`${BASE}?projectId=${projectAId}&pageSize=100`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThan(0);
      for (const item of res.body.items) {
        expect(item.projectId).toBe(projectAId);
      }
      expect(res.body.items.some((item: { title: string }) => item.title === 'Somente projeto B')).toBe(
        false,
      );
    });

    it('filtra por texto (q) no título', async () => {
      const res = await request(server)
        .get(`${BASE}?projectId=${projectAId}&q=Idempotente`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Idempotente');
    });

    it('filtra por status', async () => {
      const res = await request(server)
        .get(`${BASE}?projectId=${projectAId}&status=${OccurrenceStatus.ABERTO}`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .expect(200);

      expect(res.body.items.every((item: { status: string }) => item.status === 'ABERTO')).toBe(true);
    });
  });

  /* -------------------------------- Detalhe ------------------------------- */

  describe('GET /occurrences/:id', () => {
    it('retorna 404 para id inexistente', async () => {
      await request(server)
        .get(`${BASE}/inexistente`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .expect(404);
    });

    it('retorna 403 para usuário sem vínculo', async () => {
      const created = await request(server)
        .post(BASE)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .set('Idempotency-Key', 'k-detail-403')
        .send(createBody())
        .expect(201);

      await request(server)
        .get(`${BASE}/${created.body.id}`)
        .set('Authorization', `Bearer ${tokens.outsider}`)
        .expect(403);
    });

    it('retorna o detalhe com autor, projeto e ambiente resolvidos', async () => {
      const created = await request(server)
        .post(BASE)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .set('Idempotency-Key', 'k-detail-ok')
        .send(createBody())
        .expect(201);

      const res = await request(server)
        .get(`${BASE}/${created.body.id}`)
        .set('Authorization', `Bearer ${tokens.tester}`)
        .expect(200);

      expect(res.body.reporter).not.toBeNull();
      expect(res.body.project.code).toBe('PROJA');
      expect(res.body.environment.id).toBe(environmentAId);
      expect(Array.isArray(res.body.attachments)).toBe(true);
      expect(Array.isArray(res.body.comments)).toBe(true);
    });
  });

  /* -------------------------------- Edição -------------------------------- */

  describe('PATCH /occurrences/:id', () => {
    let occurrenceId: string;

    beforeAll(async () => {
      const created = await request(server)
        .post(BASE)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .set('Idempotency-Key', 'k-update-base')
        .send(createBody())
        .expect(201);
      occurrenceId = created.body.id as string;
    });

    it('edita o título e registra histórico (valor anterior → novo)', async () => {
      await request(server)
        .patch(`${BASE}/${occurrenceId}`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({ title: 'Título revisado' })
        .expect(200);

      const history = prisma.state.history.filter((entry) => entry.occurrenceId === occurrenceId);
      const update = history.find(
        (entry) => entry.previousValue === 'Componente desalinhado' && entry.newValue === 'Título revisado',
      );
      expect(update).toBeDefined();
    });

    it('TESTADOR não pode alterar a prioridade (403)', async () => {
      await request(server)
        .patch(`${BASE}/${occurrenceId}`)
        .set('Authorization', `Bearer ${tokens.tester}`)
        .send({ priority: OccurrencePriority.CRITICA })
        .expect(403);
    });

    it('GESTOR altera a prioridade e registra PRIORITY_CHANGED', async () => {
      await request(server)
        .patch(`${BASE}/${occurrenceId}`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({ priority: OccurrencePriority.CRITICA })
        .expect(200);

      const changed = prisma.state.history.find(
        (entry) =>
          entry.occurrenceId === occurrenceId &&
          entry.action === 'PRIORITY_CHANGED' &&
          entry.newValue === 'CRITICA',
      );
      expect(changed).toBeDefined();
    });
  });
});
