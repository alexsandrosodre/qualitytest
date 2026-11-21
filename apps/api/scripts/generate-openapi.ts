import 'reflect-metadata';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Gera o documento OpenAPI estático em `docs/api/openapi.json`
 * (especificação mestra, seções 17.3 e 19 — ETAPA 12).
 *
 * Subir o `AppModule` completo exigiria PostgreSQL em execução, pois
 * `PrismaService.onModuleInit` chama `$connect()`. Para manter a geração
 * determinística e offline, o `PrismaService` é substituído por um stub e as
 * notificações são desabilitadas (publicador no-op, sem Redis).
 *
 * Uso (na raiz do monorepo): `npm run docs:openapi`
 */
async function generate(): Promise<void> {
  process.env['NOTIFICATIONS_ENABLED'] = 'false';

  const [{ Test }, { DocumentBuilder, SwaggerModule }, shared, { AppModule }, { PrismaService }] =
    await Promise.all([
      import('@nestjs/testing'),
      import('@nestjs/swagger'),
      import('@qualitytest/shared'),
      import('../src/app.module'),
      import('../src/prisma/prisma.service'),
    ]);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ $connect: async () => undefined, $disconnect: async () => undefined })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(shared.API_PREFIX);
  await app.init();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('QUALITY TEST API')
    .setDescription(
      'API REST da plataforma corporativa QUALITY TEST. ' +
        'Toda operação dependente de projeto valida o vínculo (ProjectMember) do usuário autenticado.',
    )
    .setVersion(shared.API_VERSION)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const outputPath = resolve(__dirname, '../../../docs/api/openapi.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  const routeCount = Object.keys(document.paths ?? {}).length;
  console.log(`OpenAPI gerado em ${outputPath} (${routeCount} rotas).`);

  await app.close();
}

generate().catch((error: unknown) => {
  const message: string = error instanceof Error ? error.message : String(error);
  console.error(`Falha ao gerar o OpenAPI: ${message}`);
  process.exitCode = 1;
});
