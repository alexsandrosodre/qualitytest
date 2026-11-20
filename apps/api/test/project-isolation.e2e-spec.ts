import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GlobalRole, ProjectRole } from '@prisma/client';
import { API_PREFIX } from '@qualitytest/shared';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/common/password/password.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from './prisma-mock';

const PASSWORD = 'Senha@12345';

describe('Isolamento por projeto (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaMock;
  let passwordHash: string;

  let projectAId: string;
  let projectBId: string;
  let gestorId: string;
  let outsiderId: string;
  let adminToken: string;
  let gestorToken: string;
  let testerToken: string;
  let outsiderToken: string;

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
    const outsider = prisma.seedUser({
      name: 'Outsider',
      email: 'outsider@test.local',
      passwordHash,
    });
    gestorId = gestor.id;
    outsiderId = outsider.id;

    const projectA = prisma.seedProject({ name: 'Projeto A', code: 'PA' });
    const projectB = prisma.seedProject({ name: 'Projeto B', code: 'PB' });
    projectAId = projectA.id;
    projectBId = projectB.id;

    prisma.seedMember({ projectId: projectA.id, userId: gestor.id, role: ProjectRole.GESTOR });
    prisma.seedMember({ projectId: projectA.id, userId: tester.id, role: ProjectRole.TESTADOR });

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

  it('exige autenticação nas rotas de membros', async () => {
    await request(server).get(`/${API_PREFIX}/projects/${projectAId}/members`).expect(401);
  });

  it('administrador global acessa qualquer projeto', async () => {
    await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(server)
      .get(`/${API_PREFIX}/projects/${projectBId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('membro ativo acessa apenas o próprio projeto', async () => {
    await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}/members`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(200);

    await request(server)
      .get(`/${API_PREFIX}/projects/${projectBId}/members`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(403);
  });

  it('usuário sem vínculo recebe 403', async () => {
    await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}/members`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('papel TESTADOR não pode adicionar membros (403)', async () => {
    await request(server)
      .post(`/${API_PREFIX}/projects/${projectAId}/members`)
      .set('Authorization', `Bearer ${testerToken}`)
      .send({ userId: outsiderId, role: ProjectRole.DESENVOLVEDOR })
      .expect(403);
  });

  it('papel GESTOR pode adicionar membros no próprio projeto (201)', async () => {
    await request(server)
      .post(`/${API_PREFIX}/projects/${projectAId}/members`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ userId: outsiderId, role: ProjectRole.DESENVOLVEDOR })
      .expect(201);
  });

  it('GESTOR não pode adicionar membros onde não possui vínculo (403)', async () => {
    await request(server)
      .post(`/${API_PREFIX}/projects/${projectBId}/members`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ userId: outsiderId, role: ProjectRole.DESENVOLVEDOR })
      .expect(403);
  });

  it('apenas ADMINISTRADOR lista todos os usuários', async () => {
    await request(server)
      .get(`/${API_PREFIX}/users`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(403);

    await request(server)
      .get(`/${API_PREFIX}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('não-admin só consulta o próprio perfil', async () => {
    await request(server)
      .get(`/${API_PREFIX}/users/${outsiderId}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(403);

    await request(server)
      .get(`/${API_PREFIX}/users/${gestorId}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(200);
  });
});
