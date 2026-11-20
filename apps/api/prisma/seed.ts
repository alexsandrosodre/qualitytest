/**
 * Seed de DESENVOLVIMENTO do QUALITY TEST.
 *
 * Cria:
 *  - 1 usuário administrador (senha vinda de SEED_ADMIN_PASSWORD);
 *  - 2 projetos de exemplo: "Intranet Maricá" e "Portal da Tecnologia";
 *  - vínculo (ProjectMember) do administrador nos dois projetos.
 *
 * Este script NÃO deve ser executado em produção. A senha nunca é versionada:
 * se SEED_ADMIN_PASSWORD estiver ausente, o seed falha com mensagem clara.
 */
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Carrega o `.env` da raiz do monorepo quando existir (node >= 20.12).
// O arquivo é opcional: em CI/pipelines as variáveis vêm do próprio ambiente.
try {
  process.loadEnvFile(path.resolve(__dirname, '../../../.env'));
} catch {
  // Sem `.env` na raiz: segue com as variáveis já presentes no ambiente.
}

const prisma = new PrismaClient();

interface SeedProject {
  name: string;
  code: string;
  description: string;
}

const SEED_PROJECTS: readonly SeedProject[] = [
  {
    name: 'Intranet Maricá',
    code: 'INTRANET-MARICA',
    description: 'Projeto de exemplo criado pelo seed de desenvolvimento.',
  },
  {
    name: 'Portal da Tecnologia',
    code: 'PORTAL-TECNOLOGIA',
    description: 'Projeto de exemplo criado pelo seed de desenvolvimento.',
  },
];

const BCRYPT_ROUNDS = 12;

function readAdminPassword(): string {
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (password === undefined || password.trim().length === 0) {
    throw new Error(
      'SEED_ADMIN_PASSWORD não definida ou vazia. Este seed é apenas para desenvolvimento. ' +
        'Defina uma senha de teste antes de executar, por exemplo: ' +
        '$env:SEED_ADMIN_PASSWORD="Teste@12345" (PowerShell) ou ' +
        'SEED_ADMIN_PASSWORD="Teste@12345" (bash).',
    );
  }

  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD deve ter ao menos 8 caracteres.');
  }

  return password;
}

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@qualitytest.local';
  const adminPassword = readAdminPassword();
  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Administrador (seed)',
      passwordHash,
      globalRole: 'ADMINISTRADOR',
      status: 'ATIVO',
    },
    create: {
      name: 'Administrador (seed)',
      email: adminEmail,
      passwordHash,
      globalRole: 'ADMINISTRADOR',
      status: 'ATIVO',
    },
  });

  for (const project of SEED_PROJECTS) {
    const created = await prisma.project.upsert({
      where: { code: project.code },
      update: {
        name: project.name,
        description: project.description,
        status: 'ATIVO',
      },
      create: {
        name: project.name,
        code: project.code,
        description: project.description,
        status: 'ATIVO',
      },
    });

    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: created.id,
          userId: admin.id,
        },
      },
      update: { role: 'GESTOR', status: 'ATIVO' },
      create: {
        projectId: created.id,
        userId: admin.id,
        role: 'GESTOR',
        status: 'ATIVO',
        addedBy: admin.id,
      },
    });
  }

  console.log(`[seed] administrador de desenvolvimento: ${adminEmail}`);
  console.log(`[seed] projetos: ${SEED_PROJECTS.map((project) => project.code).join(', ')}`);
  console.log('[seed] concluído. Estas credenciais são apenas de desenvolvimento.');
}

main()
  .catch((error: unknown) => {
    console.error('[seed] falhou:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
