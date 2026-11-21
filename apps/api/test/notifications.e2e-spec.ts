import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  GlobalRole,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  OccurrencePriority,
  ProjectRole,
} from '@prisma/client';
import { API_PREFIX, type NotificationJobPayload } from '@qualitytest/shared';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/common/password/password.service';
import {
  NOTIFICATION_PUBLISHER,
  type NotificationPublisher,
} from '../src/notifications/notification-publisher';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from './prisma-mock';

const PASSWORD = 'Senha@12345';

describe('Notificações (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaMock;
  let passwordHash: string;

  let adminToken: string;
  let gestorToken: string;
  let testerToken: string;
  let outsiderToken: string;

  let projectAId: string;
  let projectBId: string;
  let occurrenceAId: string;

  /** Publisher falso: registra os eventos publicados sem exigir Redis. */
  const publishedEvents: NotificationJobPayload[] = [];
  const fakePublisher: NotificationPublisher = {
    async publish(payload) {
      publishedEvents.push(payload);
    },
  };

  beforeAll(async () => {
    passwordHash = await new PasswordService().hash(PASSWORD);
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(NOTIFICATION_PUBLISHER)
      .useValue(fakePublisher)
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

    const projectA = prisma.seedProject({ name: 'Projeto A', code: 'PROJA' });
    const projectB = prisma.seedProject({ name: 'Projeto B', code: 'PROJB' });
    projectAId = projectA.id;
    projectBId = projectB.id;

    prisma.seedMember({ projectId: projectA.id, userId: gestor.id, role: ProjectRole.GESTOR });
    prisma.seedMember({ projectId: projectA.id, userId: tester.id, role: ProjectRole.TESTADOR });

    occurrenceAId = prisma.seedOccurrence({
      projectId: projectA.id,
      reporterUserId: tester.id,
      title: 'Erro no botão de envio',
    }).id;

    adminToken = await login('admin@test.local');
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

  function destinationsUrl(projectId: string): string {
    return `/${API_PREFIX}/projects/${projectId}/notifications/destinations`;
  }

  function rulesUrl(projectId: string): string {
    return `/${API_PREFIX}/projects/${projectId}/notifications/rules`;
  }

  function deliveriesUrl(projectId: string): string {
    return `/${API_PREFIX}/projects/${projectId}/notifications/deliveries`;
  }

  /* ------------------------------- Destinos ------------------------------- */

  describe('Destinos de notificação', () => {
    let destinationId: string;

    it('exige autenticação (401)', async () => {
      await request(server)
        .post(destinationsUrl(projectAId))
        .send({ channel: NotificationChannel.WHATSAPP, destinationConfig: { recipientRef: 'x' } })
        .expect(401);
    });

    it('TESTADOR não pode criar destino (403)', async () => {
      await request(server)
        .post(destinationsUrl(projectAId))
        .set('Authorization', `Bearer ${testerToken}`)
        .send({ channel: NotificationChannel.WHATSAPP, destinationConfig: { recipientRef: 'x' } })
        .expect(403);
    });

    it('usuário sem vínculo recebe 403', async () => {
      await request(server)
        .post(destinationsUrl(projectAId))
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ channel: NotificationChannel.WHATSAPP, destinationConfig: { recipientRef: 'x' } })
        .expect(403);
    });

    it('rejeita chave não permitida em destinationConfig (400)', async () => {
      await request(server)
        .post(destinationsUrl(projectAId))
        .set('Authorization', `Bearer ${gestorToken}`)
        .send({
          channel: NotificationChannel.WHATSAPP,
          destinationConfig: { recipientRef: 'grupo', accessToken: 'segredo' },
        })
        .expect(400);
    });

    it('rejeita e-mail inválido na lista de destinatários (400)', async () => {
      await request(server)
        .post(destinationsUrl(projectAId))
        .set('Authorization', `Bearer ${gestorToken}`)
        .send({
          channel: NotificationChannel.EMAIL,
          destinationConfig: { recipients: ['nao-e-email'] },
        })
        .expect(400);
    });

    it('GESTOR cria destino e ele inicia desabilitado (201)', async () => {
      const res = await request(server)
        .post(destinationsUrl(projectAId))
        .set('Authorization', `Bearer ${gestorToken}`)
        .send({
          channel: NotificationChannel.WHATSAPP,
          destinationConfig: { recipientRef: 'grupo-homologacao' },
        })
        .expect(201);

      destinationId = res.body.id as string;
      expect(res.body.enabled).toBe(false);
      expect(res.body.projectId).toBe(projectAId);
      expect(res.body.destinationConfig.recipientRef).toBe('grupo-homologacao');

      const audit = prisma.state.auditLogs.find(
        (log) => log.action === 'NOTIFICATION_DESTINATION_CREATED' && log.entityId === destinationId,
      );
      expect(audit).toBeDefined();
    });

    it('GESTOR habilita o destino (200)', async () => {
      const res = await request(server)
        .patch(`${destinationsUrl(projectAId)}/${destinationId}`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .send({ enabled: true })
        .expect(200);

      expect(res.body.enabled).toBe(true);
    });

    it('lista apenas os destinos do projeto (isolamento)', async () => {
      prisma.seedNotificationDestination({
        projectId: projectBId,
        channel: NotificationChannel.TEAMS,
        destinationConfig: { webhookRef: 'webhook-b' },
        enabled: true,
      });

      const res = await request(server)
        .get(destinationsUrl(projectAId))
        .set('Authorization', `Bearer ${testerToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThan(0);
      for (const destination of res.body as Array<{ projectId: string }>) {
        expect(destination.projectId).toBe(projectAId);
      }
    });

    it('usuário sem vínculo não lista destinos (403)', async () => {
      await request(server)
        .get(destinationsUrl(projectAId))
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });
  });

  /* -------------------------------- Regras -------------------------------- */

  describe('Regras de notificação', () => {
    let destinationId: string;

    beforeAll(() => {
      destinationId = prisma.seedNotificationDestination({
        projectId: projectAId,
        channel: NotificationChannel.WHATSAPP,
        destinationConfig: { recipientRef: 'grupo-regras' },
        enabled: true,
      }).id;
    });

    it('TESTADOR não pode criar regra (403)', async () => {
      await request(server)
        .post(rulesUrl(projectAId))
        .set('Authorization', `Bearer ${testerToken}`)
        .send({ eventType: NotificationEventType.OCCURRENCE_CREATED, destinationId })
        .expect(403);
    });

    it('rejeita destino de outro projeto (404)', async () => {
      const foreign = prisma.seedNotificationDestination({
        projectId: projectBId,
        channel: NotificationChannel.WHATSAPP,
        destinationConfig: { recipientRef: 'grupo-b' },
        enabled: true,
      });

      await request(server)
        .post(rulesUrl(projectAId))
        .set('Authorization', `Bearer ${gestorToken}`)
        .send({ eventType: NotificationEventType.OCCURRENCE_CREATED, destinationId: foreign.id })
        .expect(404);
    });

    it('GESTOR cria regra com filtros (201)', async () => {
      const res = await request(server)
        .post(rulesUrl(projectAId))
        .set('Authorization', `Bearer ${gestorToken}`)
        .send({
          eventType: NotificationEventType.OCCURRENCE_CREATED,
          destinationId,
          filters: { priorities: [OccurrencePriority.ALTA] },
        })
        .expect(201);

      expect(res.body.projectId).toBe(projectAId);
      expect(res.body.eventType).toBe(NotificationEventType.OCCURRENCE_CREATED);
      expect(res.body.filters).toMatchObject({ priorities: [OccurrencePriority.ALTA] });
    });

    it('lista as regras do projeto', async () => {
      const res = await request(server)
        .get(rulesUrl(projectAId))
        .set('Authorization', `Bearer ${testerToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThan(0);
      for (const rule of res.body as Array<{ projectId: string }>) {
        expect(rule.projectId).toBe(projectAId);
      }
    });
  });

  /* ------------------------------- Entregas ------------------------------- */

  describe('Histórico de entregas', () => {
    let destinationId: string;
    let sentDeliveryId: string;

    beforeAll(() => {
      destinationId = prisma.seedNotificationDestination({
        projectId: projectAId,
        channel: NotificationChannel.WHATSAPP,
        destinationConfig: { recipientRef: 'grupo-entregas' },
        enabled: true,
      }).id;
      sentDeliveryId = prisma.seedNotificationDelivery({
        occurrenceId: occurrenceAId,
        destinationId,
        idempotencyKey: `occurrence:${occurrenceAId}:created:dest:${destinationId}`,
        status: NotificationDeliveryStatus.ENVIADO,
        providerMessageId: 'wamid.abc',
        attempts: 1,
      }).id;
    });

    it('lista entregas paginadas do projeto', async () => {
      const res = await request(server)
        .get(deliveriesUrl(projectAId))
        .set('Authorization', `Bearer ${testerToken}`)
        .expect(200);

      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.items.some((item: { id: string }) => item.id === sentDeliveryId)).toBe(true);
    });

    it('filtra entregas por status', async () => {
      const res = await request(server)
        .get(`${deliveriesUrl(projectAId)}?status=${NotificationDeliveryStatus.ENVIADO}`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .expect(200);

      expect(
        (res.body.items as Array<{ status: string }>).every(
          (item) => item.status === NotificationDeliveryStatus.ENVIADO,
        ),
      ).toBe(true);
    });

    it('não vaza entregas de outro projeto', async () => {
      const foreignDestination = prisma.seedNotificationDestination({
        projectId: projectBId,
        channel: NotificationChannel.WHATSAPP,
        destinationConfig: { recipientRef: 'grupo-b-entregas' },
        enabled: true,
      });
      prisma.seedNotificationDelivery({
        occurrenceId: occurrenceAId,
        destinationId: foreignDestination.id,
        idempotencyKey: 'foreign-delivery',
        status: NotificationDeliveryStatus.ENVIADO,
      });

      const res = await request(server)
        .get(`${deliveriesUrl(projectAId)}?pageSize=100`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .expect(200);

      expect(
        (res.body.items as Array<{ idempotencyKey: string }>).some(
          (item) => item.idempotencyKey === 'foreign-delivery',
        ),
      ).toBe(false);
    });
  });

  /* --------------------------- Reprocessamento ---------------------------- */

  describe('Reprocessamento administrativo', () => {
    let deliveryId: string;

    beforeAll(() => {
      const destination = prisma.seedNotificationDestination({
        projectId: projectAId,
        channel: NotificationChannel.WHATSAPP,
        destinationConfig: { recipientRef: 'grupo-reprocesso' },
        enabled: true,
      });
      deliveryId = prisma.seedNotificationDelivery({
        occurrenceId: occurrenceAId,
        destinationId: destination.id,
        idempotencyKey: `occurrence:${occurrenceAId}:created:dest:${destination.id}`,
        status: NotificationDeliveryStatus.FALHA,
        attempts: 3,
        lastError: 'Canal WhatsApp desativado.',
      }).id;
    });

    it('usuário não ADMINISTRADOR recebe 403', async () => {
      await request(server)
        .post(`/${API_PREFIX}/notifications/deliveries/${deliveryId}/reprocess`)
        .set('Authorization', `Bearer ${gestorToken}`)
        .expect(403);
    });

    it('entrega inexistente recebe 404', async () => {
      await request(server)
        .post(`/${API_PREFIX}/notifications/deliveries/inexistente/reprocess`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('ADMINISTRADOR reenfileira a entrega com nova chave (200)', async () => {
      const before = publishedEvents.length;

      await request(server)
        .post(`/${API_PREFIX}/notifications/deliveries/${deliveryId}/reprocess`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(publishedEvents.length).toBe(before + 1);
      const published = publishedEvents[publishedEvents.length - 1];
      expect(published?.occurrenceId).toBe(occurrenceAId);
      expect(published?.idempotencyKey).toContain(':r');

      const audit = prisma.state.auditLogs.find(
        (log) => log.action === 'NOTIFICATION_DELIVERY_REPROCESSED' && log.entityId === deliveryId,
      );
      expect(audit).toBeDefined();
    });
  });
});
