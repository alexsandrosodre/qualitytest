import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EnvironmentType, GlobalRole, ProjectRole, RegistrationStatus } from '@prisma/client';
import { API_PREFIX } from '@qualitytest/shared';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/common/password/password.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from './prisma-mock';

const PASSWORD = 'Senha@12345';

describe('Ambientes e domínios por projeto (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaMock;
  let passwordHash: string;

  let adminToken: string;
  let gestorAToken: string;
  let testerAToken: string;
  let gestorBToken: string;
  let outsiderToken: string;

  let projectAId: string;
  let environmentAId: string;
  let environmentBId: string;

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
    const gestorA = prisma.seedUser({ name: 'Gestor A', email: 'gestor-a@test.local', passwordHash });
    const testerA = prisma.seedUser({ name: 'Tester A', email: 'tester-a@test.local', passwordHash });
    const gestorB = prisma.seedUser({ name: 'Gestor B', email: 'gestor-b@test.local', passwordHash });
    prisma.seedUser({ name: 'Outsider', email: 'outsider@test.local', passwordHash });

    const projectA = prisma.seedProject({ name: 'Projeto A', code: 'PROJA' });
    const projectB = prisma.seedProject({ name: 'Projeto B', code: 'PROJB' });
    projectAId = projectA.id;

    prisma.seedMember({ projectId: projectA.id, userId: gestorA.id, role: ProjectRole.GESTOR });
    prisma.seedMember({ projectId: projectA.id, userId: testerA.id, role: ProjectRole.TESTADOR });
    prisma.seedMember({ projectId: projectB.id, userId: gestorB.id, role: ProjectRole.GESTOR });

    environmentAId = prisma.seedEnvironment({
      projectId: projectA.id,
      name: 'Homologação A',
      baseUrl: 'https://homolog-a.exemplo.invalid',
      type: EnvironmentType.STAGING,
    }).id;
    environmentBId = prisma.seedEnvironment({
      projectId: projectB.id,
      name: 'Homologação B',
      baseUrl: 'https://homolog-b.exemplo.invalid',
      type: EnvironmentType.STAGING,
    }).id;

    adminToken = await login('admin@test.local');
    gestorAToken = await login('gestor-a@test.local');
    testerAToken = await login('tester-a@test.local');
    gestorBToken = await login('gestor-b@test.local');
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

  it('membro ativo lista ambientes do próprio projeto', async () => {
    const res = await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}/environments`)
      .set('Authorization', `Bearer ${gestorAToken}`)
      .expect(200);

    const ids = (res.body as Array<{ id: string }>).map((item) => item.id);
    expect(ids).toContain(environmentAId);
  });

  it('membro de outro projeto não acessa ambientes (403)', async () => {
    await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}/environments`)
      .set('Authorization', `Bearer ${gestorBToken}`)
      .expect(403);
  });

  it('usuário sem vínculo não acessa domínios (403)', async () => {
    await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}/domains`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('membro de outro projeto não acessa domínios (403)', async () => {
    await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}/domains`)
      .set('Authorization', `Bearer ${gestorBToken}`)
      .expect(403);
  });

  it('ADMINISTRADOR cria ambiente; TESTADOR não (403)', async () => {
    const res = await request(server)
      .post(`/${API_PREFIX}/projects/${projectAId}/environments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Produção A', baseUrl: 'https://prod-a.exemplo.invalid', type: 'PRODUCTION' })
      .expect(201);

    expect(res.body.type).toBe(EnvironmentType.PRODUCTION);

    await request(server)
      .post(`/${API_PREFIX}/projects/${projectAId}/environments`)
      .set('Authorization', `Bearer ${testerAToken}`)
      .send({ name: 'Teste', baseUrl: 'https://x.exemplo.invalid', type: 'TESTING' })
      .expect(403);
  });

  it('rejeita baseUrl inválida (400)', async () => {
    await request(server)
      .post(`/${API_PREFIX}/projects/${projectAId}/environments`)
      .set('Authorization', `Bearer ${gestorAToken}`)
      .send({ name: 'Inválido', baseUrl: 'nao-eh-url', type: 'TESTING' })
      .expect(400);
  });

  it('GESTOR cria domínio referenciando ambiente do próprio projeto', async () => {
    const res = await request(server)
      .post(`/${API_PREFIX}/projects/${projectAId}/domains`)
      .set('Authorization', `Bearer ${gestorAToken}`)
      .send({ domainPattern: 'homolog-a.exemplo.invalid', environmentId: environmentAId })
      .expect(201);

    expect(res.body.projectId).toBe(projectAId);
    expect(res.body.environmentId).toBe(environmentAId);
  });

  it('rejeita domínio com environmentId de OUTRO projeto (400)', async () => {
    await request(server)
      .post(`/${API_PREFIX}/projects/${projectAId}/domains`)
      .set('Authorization', `Bearer ${gestorAToken}`)
      .send({ domainPattern: 'invasor.exemplo.invalid', environmentId: environmentBId })
      .expect(400);
  });

  it('rejeita domínio com environmentId inexistente (400)', async () => {
    await request(server)
      .post(`/${API_PREFIX}/projects/${projectAId}/domains`)
      .set('Authorization', `Bearer ${gestorAToken}`)
      .send({ domainPattern: 'inexistente.exemplo.invalid', environmentId: 'env-inexistente' })
      .expect(400);
  });

  it('ambiente de outro projeto é tratado como inexistente (404)', async () => {
    await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}/environments/${environmentBId}`)
      .set('Authorization', `Bearer ${gestorAToken}`)
      .expect(404);
  });

  it('DELETE ambiente realiza desativação lógica', async () => {
    const res = await request(server)
      .delete(`/${API_PREFIX}/projects/${projectAId}/environments/${environmentAId}`)
      .set('Authorization', `Bearer ${gestorAToken}`)
      .expect(200);

    expect(res.body.status).toBe(RegistrationStatus.INATIVO);

    const list = await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}/environments`)
      .set('Authorization', `Bearer ${gestorAToken}`)
      .expect(200);

    const target = (list.body as Array<{ id: string; status: string }>).find(
      (item) => item.id === environmentAId,
    );
    expect(target?.status).toBe(RegistrationStatus.INATIVO);
  });
});
