import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GlobalRole, ProjectRole, RegistrationStatus } from '@prisma/client';
import { API_PREFIX } from '@qualitytest/shared';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/common/password/password.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from './prisma-mock';

const PASSWORD = 'Senha@12345';

describe('Projetos (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaMock;
  let passwordHash: string;

  let adminToken: string;
  let memberToken: string;
  let gestorToken: string;
  let testerToken: string;
  let outsiderToken: string;

  let projectAId: string;
  let projectBId: string;

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
    const member = prisma.seedUser({ name: 'Member', email: 'member@test.local', passwordHash });
    const gestor = prisma.seedUser({ name: 'Gestor', email: 'gestor@test.local', passwordHash });
    const tester = prisma.seedUser({ name: 'Tester', email: 'tester@test.local', passwordHash });
    prisma.seedUser({ name: 'Outsider', email: 'outsider@test.local', passwordHash });

    const projectA = prisma.seedProject({ name: 'Projeto A', code: 'PROJA' });
    const projectB = prisma.seedProject({ name: 'Projeto B', code: 'PROJB' });
    projectAId = projectA.id;
    projectBId = projectB.id;

    prisma.seedMember({ projectId: projectA.id, userId: member.id, role: ProjectRole.GESTOR });
    prisma.seedMember({ projectId: projectA.id, userId: gestor.id, role: ProjectRole.GESTOR });
    prisma.seedMember({ projectId: projectA.id, userId: tester.id, role: ProjectRole.TESTADOR });

    adminToken = await login('admin@test.local');
    memberToken = await login('member@test.local');
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

  it('exige autenticação para listar projetos', async () => {
    await request(server).get(`/${API_PREFIX}/projects`).expect(401);
  });

  it('ADMINISTRADOR cria projeto e registra auditoria', async () => {
    const res = await request(server)
      .post(`/${API_PREFIX}/projects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Projeto Novo', code: 'PROJ-NOVO', description: 'Criado no teste.' })
      .expect(201);

    expect(res.body.code).toBe('PROJ-NOVO');
    expect(res.body.status).toBe(RegistrationStatus.ATIVO);

    expect(
      prisma.state.auditLogs.some(
        (entry) => entry.action === 'PROJECT_CREATED' && entry.entityId === res.body.id,
      ),
    ).toBe(true);
  });

  it('código duplicado retorna 409', async () => {
    await request(server)
      .post(`/${API_PREFIX}/projects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Primeiro', code: 'PROJ-DUP' })
      .expect(201);

    await request(server)
      .post(`/${API_PREFIX}/projects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Segundo', code: 'PROJ-DUP' })
      .expect(409);
  });

  it('não-admin não pode criar projeto (403)', async () => {
    await request(server)
      .post(`/${API_PREFIX}/projects`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ name: 'Proibido', code: 'PROJ-PROIBIDO' })
      .expect(403);
  });

  it('rejeita payload inválido com 400', async () => {
    await request(server)
      .post(`/${API_PREFIX}/projects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Inválido', code: 'codigo-minusculo' })
      .expect(400);
  });

  it('ADMINISTRADOR lista todos os projetos', async () => {
    const res = await request(server)
      .get(`/${API_PREFIX}/projects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const codes = (res.body.items as Array<{ code: string }>).map((item) => item.code);
    expect(codes).toContain('PROJA');
    expect(codes).toContain('PROJB');
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('usuário comum lista apenas projetos com vínculo ativo', async () => {
    const res = await request(server)
      .get(`/${API_PREFIX}/projects`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    const codes = (res.body.items as Array<{ code: string }>).map((item) => item.code);
    expect(codes).toContain('PROJA');
    expect(codes).not.toContain('PROJB');
  });

  it('usuário sem vínculo em GET /projects/:id recebe 403 (não 200)', async () => {
    await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('membro ativo obtém o detalhe do projeto', async () => {
    const res = await request(server)
      .get(`/${API_PREFIX}/projects/${projectAId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.id).toBe(projectAId);
  });

  it('ADMINISTRADOR edita o projeto', async () => {
    const res = await request(server)
      .patch(`/${API_PREFIX}/projects/${projectBId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Projeto B (editado)' })
      .expect(200);

    expect(res.body.name).toBe('Projeto B (editado)');
  });

  it('GESTOR do projeto pode editar; TESTADOR não (403)', async () => {
    await request(server)
      .patch(`/${API_PREFIX}/projects/${projectAId}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ description: 'Atualizado pelo gestor.' })
      .expect(200);

    await request(server)
      .patch(`/${API_PREFIX}/projects/${projectAId}`)
      .set('Authorization', `Bearer ${testerToken}`)
      .send({ description: 'Tentativa do testador.' })
      .expect(403);
  });

  it('GESTOR de outro projeto não edita (403)', async () => {
    await request(server)
      .patch(`/${API_PREFIX}/projects/${projectBId}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ name: 'Nao permitido' })
      .expect(403);
  });

  it('PATCH /projects/:id/status é restrito ao ADMINISTRADOR', async () => {
    await request(server)
      .patch(`/${API_PREFIX}/projects/${projectAId}/status`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ status: RegistrationStatus.INATIVO })
      .expect(403);

    const res = await request(server)
      .patch(`/${API_PREFIX}/projects/${projectBId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: RegistrationStatus.INATIVO })
      .expect(200);

    expect(res.body.status).toBe(RegistrationStatus.INATIVO);
  });
});
