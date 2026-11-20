import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GlobalRole, ProjectRole } from '@prisma/client';
import { API_PREFIX } from '@qualitytest/shared';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/common/password/password.service';
import { TokenService } from '../src/common/tokens/token.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from './prisma-mock';

const PASSWORD = 'Senha@12345';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaMock;
  let passwordHash: string;
  let tokenService: TokenService;

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
    tokenService = app.get(TokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prisma.state.users.length = 0;
    prisma.state.projects.length = 0;
    prisma.state.members.length = 0;
    prisma.state.sessions.length = 0;
    prisma.state.auditLogs.length = 0;
  });

  function seedUser(globalRole: GlobalRole | null = null) {
    return prisma.seedUser({
      name: 'Usuário Teste',
      email: 'usuario@test.local',
      passwordHash,
      globalRole,
    });
  }

  function login() {
    return request(server)
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'usuario@test.local', password: PASSWORD })
      .expect(200);
  }

  it('login retorna tokens e não expõe passwordHash', async () => {
    const user = seedUser(GlobalRole.ADMINISTRADOR);

    const res = await login();

    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('login com senha incorreta retorna 401', async () => {
    seedUser();

    await request(server)
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'usuario@test.local', password: 'senha-errada' })
      .expect(401);
  });

  it('login de e-mail desconhecido retorna 401', async () => {
    await request(server)
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'nao-existe@test.local', password: PASSWORD })
      .expect(401);
  });

  it('rejeita payload inválido com 400', async () => {
    await request(server)
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'nao-e-um-email' })
      .expect(400);
  });

  it('GET /auth/me exige autenticação', async () => {
    await request(server).get(`/${API_PREFIX}/auth/me`).expect(401);
  });

  it('GET /auth/me retorna o usuário e os projetos vinculados', async () => {
    const user = seedUser();
    const project = prisma.seedProject({ name: 'Portal', code: 'PORTAL' });
    prisma.seedMember({ projectId: project.id, userId: user.id, role: ProjectRole.GESTOR });

    const { body } = await login();
    const res = await request(server)
      .get(`/${API_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);

    expect(res.body.user.id).toBe(user.id);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].code).toBe('PORTAL');
    expect(res.body.projects[0].role).toBe(ProjectRole.GESTOR);
  });

  it('refresh rotaciona o token e invalida o anterior', async () => {
    seedUser();
    const { body } = await login();

    const refreshed = await request(server)
      .post(`/${API_PREFIX}/auth/refresh`)
      .send({ refreshToken: body.refreshToken })
      .expect(200);

    expect(refreshed.body.refreshToken).not.toBe(body.refreshToken);

    await request(server)
      .post(`/${API_PREFIX}/auth/refresh`)
      .send({ refreshToken: body.refreshToken })
      .expect(401);
  });

  it('logout revoga a sessão', async () => {
    seedUser();
    const { body } = await login();

    await request(server)
      .post(`/${API_PREFIX}/auth/logout`)
      .send({ refreshToken: body.refreshToken })
      .expect(200);

    await request(server)
      .post(`/${API_PREFIX}/auth/refresh`)
      .send({ refreshToken: body.refreshToken })
      .expect(401);
  });

  it('forgot-password responde igual para e-mail existente e inexistente', async () => {
    seedUser();

    const existing = await request(server)
      .post(`/${API_PREFIX}/auth/forgot-password`)
      .send({ email: 'usuario@test.local' })
      .expect(200);
    const missing = await request(server)
      .post(`/${API_PREFIX}/auth/forgot-password`)
      .send({ email: 'nao-existe@test.local' })
      .expect(200);

    expect(existing.body.message).toBe(missing.body.message);
  });

  it('reset-password redefine a senha e invalida a senha antiga', async () => {
    const user = seedUser();
    const rawToken = 'reset-e2e-token';
    await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: `reset:${tokenService.hashRefreshToken(rawToken)}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await request(server)
      .post(`/${API_PREFIX}/auth/reset-password`)
      .send({ token: rawToken, newPassword: 'NovaSenha@123' })
      .expect(200);

    await request(server)
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'usuario@test.local', password: 'NovaSenha@123' })
      .expect(200);

    await request(server)
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: 'usuario@test.local', password: PASSWORD })
      .expect(401);
  });
});
