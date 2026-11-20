import { API_PREFIX, API_VERSION } from '@qualitytest/shared';

const FOUNDATION_ITEMS = [
  'Monorepositório com npm workspaces',
  'TypeScript strict, ESLint e Prettier',
  'Docker Compose (PostgreSQL, Redis e MinIO)',
  'API NestJS com Prisma e Swagger',
  'Worker BullMQ (esqueleto)',
  'CI inicial no GitHub Actions',
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Plataforma corporativa
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">QUALITY TEST</h1>
        <p className="text-slate-600">
          Centralização de testes, registro de defeitos e acompanhamento de homologação por projeto.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-900">Fundação pronta (Etapa 2)</h2>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          A base técnica do projeto está configurada. As telas do produto (login, projetos,
          ocorrências e demais módulos) serão implementadas a partir da Etapa 3.
        </p>

        <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          {FOUNDATION_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-1 text-emerald-600">
                &bull;
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-dashed border-slate-300 p-6">
        <h3 className="text-sm font-semibold text-slate-700">Referências técnicas</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-slate-500">Prefixo da API</dt>
          <dd className="font-mono text-slate-800">/{API_PREFIX}</dd>
          <dt className="text-slate-500">Versão compartilhada</dt>
          <dd className="font-mono text-slate-800">{API_VERSION}</dd>
          <dt className="text-slate-500">Documentação Swagger</dt>
          <dd className="font-mono text-slate-800">/{API_PREFIX}/docs</dd>
          <dt className="text-slate-500">Verificação de saúde</dt>
          <dd className="font-mono text-slate-800">/{API_PREFIX}/health</dd>
        </dl>
      </section>

      <footer className="text-xs text-slate-400">
        Nenhuma tela de produto foi implementada nesta etapa. Este é apenas o shell corporativo da
        fundação.
      </footer>
    </main>
  );
}
