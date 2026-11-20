import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EnvironmentType, GlobalRole, ProjectRole } from '@prisma/client';
import { API_PREFIX } from '@qualitytest/shared';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/common/password/password.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from './prisma-mock';

const PASSWORD = 'Senha@12345';

describe('Sugestão de projeto por domínio (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaMock;

  let adminToken: string;
  let memberToken: string;

  let projectAId: string;
  let projectBId: string;

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
    const member = prisma.seedUser({ name: 'Member', email: 'member@test.local', passwordHash });
    prisma.seedUser({ name: 'Outsider', email: 'outsider@test.local', passwordHash });

    const projectA = prisma.seedProject({ name: 'Intranet Maricá', code: 'INTRANET' });
    const projectB = prisma.seedProject({ name: 'Portal da Tecnologia', code: 'PORTAL' });
    const projectC = prisma.seedProject({ name: 'Projeto Ambíguo', code: 'AMBIGUO' });
    projectAId = projectA.id;
    projectBId = projectB.id;

    prisma.seedMember({ projectId: projectA.id, userId: member.id, role: ProjectRole.TESTADOR });

    const envA = prisma.seedEnvironment({
      projectId: projectA.id,
      name: 'Homologação',
      baseUrl: 'https://intranet.invalid',
      type: EnvironmentType.STAGING,
    });
    const envB = prisma.seedEnvironment({
      projectId: projectB.id,
      name: 'Homologação',
      baseUrl: 'https://portal.invalid',
      type: EnvironmentType.STAGING,
    });
    const envC = prisma.seedEnvironment({
      projectId: projectC.id,
      name: 'Homologação',
      baseUrl: 'https://ambiguo.invalid',
      type: EnvironmentType.STAGING,
    });

    prisma.seedDomainMapping({
      projectId: projectA.id,
      domainPattern: 'intranet.invalid',
      environmentId: envA.id,
    });
    // Mapeamento desabilitado: não deve sugerir.
    prisma.seedDomainMapping({
      projectId: projectA.id,
      domainPattern: 'desabilitado.invalid',
      environmentId: envA.id,
      enabled: false,
    });
    prisma.seedDomainMapping({
      projectId: projectB.id,
      domainPattern: 'portal.invalid',
      environmentId: envB.id,
    });
    // Mesmo domínio em dois projetos → ambíguo (para quem enxerga ambos).
    prisma.seedDomainMapping({
      projectId: projectA.id,
      domainPattern: 'ambiguo.invalid',
      environmentId: envA.id,
    });
    prisma.seedDomainMapping({
      projectId: projectC.id,
      domainPattern: 'ambiguo.invalid',
      environmentId: envC.id,
    });

    adminToken = await login('admin@test.local');
    memberToken = await login('member@test.local');
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

  it('exige autenticação', async () => {
    await request(server)
      .get(`/${API_PREFIX}/projects/suggest`)
      .query({ url: 'https://intranet.invalid/' })
      .expect(401);
  });

  it('rejeita requisição sem url (400)', async () => {
    await request(server)
      .get(`/${API_PREFIX}/projects/suggest`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(400);
  });

  it('sugere o projeto do vínculo para o domínio correspondente', async () => {
    const res = await request(server)
      .get(`/${API_PREFIX}/projects/suggest`)
      .set('Authorization', `Bearer ${memberToken}`)
      .query({ url: 'https://intranet.invalid/pedidos/42' })
      .expect(200);

    expect(res.body.ambiguous).toBe(false);
    expect(res.body.suggestions).toEqual([
      { projectId: projectAId, name: 'Intranet Maricá', confidence: 'alta' },
    ]);
  });

  it('não sugere projeto sem vínculo (isolamento)', async () => {
    const res = await request(server)
      .get(`/${API_PREFIX}/projects/suggest`)
      .set('Authorization', `Bearer ${memberToken}`)
      .query({ url: 'https://portal.invalid/login' })
      .expect(200);

    expect(res.body.suggestions).toEqual([]);
    expect(res.body.ambiguous).toBe(false);
  });

  it('ADMINISTRADOR enxerga a sugestão de qualquer projeto', async () => {
    const res = await request(server)
      .get(`/${API_PREFIX}/projects/suggest`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ url: 'https://portal.invalid/' })
      .expect(200);

    expect(res.body.suggestions).toEqual([
      { projectId: projectBId, name: 'Portal da Tecnologia', confidence: 'alta' },
    ]);
    expect(res.body.ambiguous).toBe(false);
  });

  it('ignora mapeamento desabilitado', async () => {
    const res = await request(server)
      .get(`/${API_PREFIX}/projects/suggest`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ url: 'https://desabilitado.invalid/' })
      .expect(200);

    expect(res.body.suggestions).toEqual([]);
  });

  it('sinaliza ambiguidade quando mais de um projeto corresponde', async () => {
    const res = await request(server)
      .get(`/${API_PREFIX}/projects/suggest`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ url: 'https://ambiguo.invalid/x' })
      .expect(200);

    expect(res.body.ambiguous).toBe(true);
    expect(res.body.suggestions).toHaveLength(2);
    expect(
      (res.body.suggestions as Array<{ confidence: string }>).every(
        (item) => item.confidence === 'media',
      ),
    ).toBe(true);
  });
});
