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

describe('Status e responsável de ocorrências (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaMock;

  let projectId: string;
  let gestorToken: string;
  let testerToken: string;
  let devToken: string;
  let devUserId: string;
  let outsiderId: string;

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
    const dev = prisma.seedUser({ name: 'Dev', email: 'dev@test.local', passwordHash });
    const outsider = prisma.seedUser({
      name: 'Outsider',
      email: 'outsider@test.local',
      passwordHash,
    });
    devUserId = dev.id;
    outsiderId = outsider.id;

    const project = prisma.seedProject({ name: 'Projeto', code: 'PROJ' });
    const other = prisma.seedProject({ name: 'Outro', code: 'OUTRO' });
    projectId = project.id;

    prisma.seedMember({ projectId: project.id, userId: gestor.id, role: ProjectRole.GESTOR });
    prisma.seedMember({ projectId: project.id, userId: tester.id, role: ProjectRole.TESTADOR });
    prisma.seedMember({ projectId: project.id, userId: dev.id, role: ProjectRole.DESENVOLVEDOR });
    // Vínculo em OUTRO projeto, para provar o isolamento na atribuição.
    prisma.seedMember({ projectId: other.id, userId: outsider.id, role: ProjectRole.TESTADOR });

    gestorToken = await login('gestor@test.local');
    testerToken = await login('tester@test.local');
    devToken = await login('dev@test.local');
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
        title: 'Falha intermitente',
        categoryId: OccurrenceCategory.ERRO_FUNCIONAL,
        priority: OccurrencePriority.MEDIA,
      })
      .expect(201);
    return res.body.id as string;
  }

  /* ------------------------------ Responsável ----------------------------- */

  describe('PATCH /occurrences/:id/assignee', () => {
    it('GESTOR atribui um membro ATIVO do mesmo projeto (200)', async () => {
      const id = await createOccurrence(gestorToken, 'k-assign-1');

      const res = await request(server)
        .patch(`${BASE}/${id}/assignee`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .send({ assigneeUserId: devUserId })
        .expect(200);

      expect(res.body.assigneeUserId).toBe(devUserId);

      const history = prisma.state.history.find(
        (entry) => entry.occurrenceId === id && entry.action === 'ASSIGNEE_CHANGED',
      );
      expect(history?.newValue).toBe(devUserId);
    });

    it('rejeita responsável que não é membro do mesmo projeto (400)', async () => {
      const id = await createOccurrence(gestorToken, 'k-assign-2');

      await request(server)
        .patch(`${BASE}/${id}/assignee`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .send({ assigneeUserId: outsiderId })
        .expect(400);
    });

    it('TESTADOR não pode atribuir responsável (403)', async () => {
      const id = await createOccurrence(gestorToken, 'k-assign-3');

      await request(server)
        .patch(`${BASE}/${id}/assignee`)
        .set('Authorization', `Bearer ${testerToken}`)
        .send({ assigneeUserId: devUserId })
        .expect(403);
    });
  });

  /* -------------------------------- Status -------------------------------- */

  describe('PATCH /occurrences/:id/status', () => {
    function changeStatus(
      token: string,
      id: string,
      status: OccurrenceStatus,
      justification?: string,
    ) {
      return request(server)
        .patch(`${BASE}/${id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send(justification === undefined ? { status } : { status, justification });
    }

    it('percorre o fluxo feliz até CONCLUIDO (200) e registra histórico', async () => {
      const id = await createOccurrence(gestorToken, 'k-status-flow');

      await changeStatus(gestorToken, id, OccurrenceStatus.EM_ANALISE).expect(200);
      await changeStatus(gestorToken, id, OccurrenceStatus.EM_DESENVOLVIMENTO).expect(200);
      await changeStatus(gestorToken, id, OccurrenceStatus.AGUARDANDO_HOMOLOGACAO).expect(200);
      const done = await changeStatus(gestorToken, id, OccurrenceStatus.CONCLUIDO).expect(200);

      expect(done.body.status).toBe(OccurrenceStatus.CONCLUIDO);

      const statusChanges = prisma.state.history.filter(
        (entry) => entry.occurrenceId === id && entry.action === 'STATUS_CHANGED',
      );
      expect(statusChanges).toHaveLength(4);
    });

    it('DESENVOLVEDOR pode conduzir o trabalho técnico (200)', async () => {
      const id = await createOccurrence(gestorToken, 'k-status-dev');
      await changeStatus(gestorToken, id, OccurrenceStatus.EM_ANALISE).expect(200);
      await changeStatus(devToken, id, OccurrenceStatus.EM_DESENVOLVIMENTO).expect(200);
    });

    it('TESTADOR não pode alterar status (403)', async () => {
      const id = await createOccurrence(gestorToken, 'k-status-tester');
      await changeStatus(testerToken, id, OccurrenceStatus.EM_ANALISE).expect(403);
    });

    it('transição inválida retorna 422', async () => {
      const id = await createOccurrence(gestorToken, 'k-status-invalid');
      await changeStatus(gestorToken, id, OccurrenceStatus.CONCLUIDO).expect(422);
    });

    it('cancelamento exige justificativa (400 sem, 200 com)', async () => {
      const id = await createOccurrence(gestorToken, 'k-status-cancel');

      await changeStatus(gestorToken, id, OccurrenceStatus.CANCELADO).expect(400);
      const cancelled = await changeStatus(
        gestorToken,
        id,
        OccurrenceStatus.CANCELADO,
        'Ocorrência duplicada.',
      ).expect(200);

      expect(cancelled.body.status).toBe(OccurrenceStatus.CANCELADO);

      const audit = prisma.state.auditLogs.find(
        (log) => log.action === 'OCCURRENCE_STATUS_CHANGED' && log.entityId === id,
      );
      expect(audit).toBeDefined();
    });
  });
});
