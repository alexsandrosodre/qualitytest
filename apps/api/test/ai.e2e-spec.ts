import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OccurrenceCategory, OccurrencePriority, ProjectRole } from '@prisma/client';
import { AI_SUGGESTION_TYPES, API_PREFIX, AiSuggestionType } from '@qualitytest/shared';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  AI_PROVIDER,
  LocalDeterministicAiProvider,
  type AiProvider,
  type AiProviderInput,
} from '../src/ai/ai-provider';
import { PasswordService } from '../src/common/password/password.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from './prisma-mock';

const PASSWORD = 'Senha@12345';

/**
 * Provedor controlável: delega ao provedor local determinístico real e permite
 * ligar/desligar o módulo em runtime, exercitando o caminho de IA desativada
 * sem recriar a aplicação Nest.
 */
class ControllableAiProvider implements AiProvider {
  readonly name = 'local-deterministic';
  readonly model = 'heuristic-v1';
  enabled = true;
  private readonly inner = new LocalDeterministicAiProvider();

  suggest(input: AiProviderInput) {
    return this.inner.suggest(input);
  }
}

describe('IA opcional (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaMock;
  let provider: ControllableAiProvider;

  let testerToken: string;
  let outsiderToken: string;

  let occurrenceAId: string;
  let occurrenceBId: string;

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(PASSWORD);
    prisma = createPrismaMock();
    provider = new ControllableAiProvider();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AI_PROVIDER)
      .useValue(provider)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    server = app.getHttpServer() as Server;

    const tester = prisma.seedUser({ name: 'Tester', email: 'tester@test.local', passwordHash });
    prisma.seedUser({ name: 'Outsider', email: 'outsider@test.local', passwordHash });

    const projectA = prisma.seedProject({ name: 'Projeto A', code: 'PROJA' });
    const projectB = prisma.seedProject({ name: 'Projeto B', code: 'PROJB' });

    prisma.seedMember({ projectId: projectA.id, userId: tester.id, role: ProjectRole.TESTADOR });

    occurrenceAId = prisma.seedOccurrence({
      projectId: projectA.id,
      reporterUserId: tester.id,
      title: 'Crash ao salvar cadastro — integração com a API falha',
      description: 'Ao salvar o cadastro ocorre perda de dados; a integração com a API retorna erro.',
      categoryId: OccurrenceCategory.OUTROS,
      priority: OccurrencePriority.BAIXA,
    }).id;

    // Candidata semelhante para a detecção de duplicidade (mesmo projeto).
    prisma.seedOccurrence({
      projectId: projectA.id,
      reporterUserId: tester.id,
      title: 'Crash ao salvar cadastro com integração',
      categoryId: OccurrenceCategory.OUTROS,
      priority: OccurrencePriority.BAIXA,
    });

    occurrenceBId = prisma.seedOccurrence({
      projectId: projectB.id,
      reporterUserId: tester.id,
      title: 'Ocorrência de outro projeto',
    }).id;

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

  function aiUrl(occurrenceId: string): string {
    return `/${API_PREFIX}/occurrences/${occurrenceId}/ai-analyses`;
  }

  it('exige autenticação (401)', async () => {
    await request(server).get(aiUrl(occurrenceAId)).expect(401);
  });

  it('membro ativo lista as análises e vê o estado do módulo', async () => {
    const res = await request(server)
      .get(aiUrl(occurrenceAId))
      .set('Authorization', `Bearer ${testerToken}`)
      .expect(200);

    expect(res.body.enabled).toBe(true);
    expect(res.body.provider).toBe('local-deterministic');
    expect(res.body.items).toEqual([]);
  });

  it('usuário sem vínculo com o projeto recebe 403', async () => {
    await request(server)
      .get(aiUrl(occurrenceAId))
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('ocorrência inexistente recebe 404', async () => {
    await request(server)
      .post(aiUrl('inexistente'))
      .set('Authorization', `Bearer ${testerToken}`)
      .expect(404);
  });

  it('membro ativo gera sugestões, que são registradas e auditadas (201)', async () => {
    const before = prisma.state.aiAnalyses.length;

    const res = await request(server)
      .post(aiUrl(occurrenceAId))
      .set('Authorization', `Bearer ${testerToken}`)
      .expect(201);

    expect(res.body.occurrenceId).toBe(occurrenceAId);
    expect(res.body.provider).toBe('local-deterministic');
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThan(0);

    for (const suggestion of res.body.suggestions as Array<{ type: string }>) {
      expect(AI_SUGGESTION_TYPES).toContain(suggestion.type);
    }

    const types = (res.body.suggestions as Array<{ type: string }>).map((item) => item.type);
    expect(types).toContain(AiSuggestionType.RESUMO);
    expect(types).toContain(AiSuggestionType.CATEGORIA);
    expect(types).toContain(AiSuggestionType.PRIORIDADE);
    expect(types).toContain(AiSuggestionType.DUPLICIDADE);

    const category = (res.body.suggestions as Array<{ type: string; value: string }>).find(
      (item) => item.type === AiSuggestionType.CATEGORIA,
    );
    expect(category?.value).toBe(OccurrenceCategory.ERRO_INTEGRACAO);

    expect(prisma.state.aiAnalyses.length).toBe(before + 1);
    const audit = prisma.state.auditLogs.find(
      (log) => log.action === 'AI_ANALYSIS_GENERATED' && log.entityId === res.body.id,
    );
    expect(audit).toBeDefined();
  });

  it('lista as sugestões já registradas (mais recentes primeiro)', async () => {
    const res = await request(server)
      .get(aiUrl(occurrenceAId))
      .set('Authorization', `Bearer ${testerToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0].occurrenceId).toBe(occurrenceAId);
  });

  it('não acessa a ocorrência de outro projeto (403)', async () => {
    await request(server)
      .post(aiUrl(occurrenceBId))
      .set('Authorization', `Bearer ${testerToken}`)
      .expect(403);
  });

  it('com o módulo desativado, a geração responde 503 e a listagem indica enabled=false', async () => {
    provider.enabled = false;
    try {
      await request(server)
        .post(aiUrl(occurrenceAId))
        .set('Authorization', `Bearer ${testerToken}`)
        .expect(503);

      const res = await request(server)
        .get(aiUrl(occurrenceAId))
        .set('Authorization', `Bearer ${testerToken}`)
        .expect(200);

      expect(res.body.enabled).toBe(false);
    } finally {
      provider.enabled = true;
    }
  });
});
