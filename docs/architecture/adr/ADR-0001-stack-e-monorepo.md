# ADR-0001 — Stack Tecnológica e Monorepositório

**Versão:** 1.0
**Data:** 21/11/2026
**Status do documento:** Implementado
**Status do ADR:** Aceito
**Contexto da decisão:** ETAPA 1 — Diagnóstico e Arquitetura

---

## Contexto

O QUALITY TEST é uma plataforma corporativa multi-projeto que deve entregar uma aplicação **funcional** com persistência real, autenticação, autorização, validação, tratamento de erros, testes e documentação (seção 0 da especificação). A especificação (seção 12) já indica uma stack preferencial e uma organização de monorepositório.

O repositório oficial está vazio e não há implementação. É necessário decidir formalmente a stack e a organização do código antes de iniciar a fundação (ETAPA 2), para evitar retrabalho e incompatibilidades entre agentes.

---

## Decisão

Adotar a stack e o monorepositório propostos pela especificação:

- **Frontend:** Next.js (App Router) + React + TypeScript strict + Tailwind CSS + shadcn/ui + TanStack Query + React Hook Form + Zod.
- **Backend:** Node.js + NestJS + TypeScript + REST + Prisma ORM + Swagger/OpenAPI.
- **Dados:** PostgreSQL.
- **Filas:** Redis + BullMQ.
- **Extensão:** Chrome Manifest V3 + TypeScript (+ React, se adequado).
- **Armazenamento:** S3 ou compatível, URLs assinadas, validação de tipo/tamanho.
- **Testes:** Jest ou Vitest (conforme compatibilidade) + Supertest + Playwright.

**Organização (monorepositório):** `apps/{web,api,extension,worker}` + `packages/{shared,types,config}` + `infrastructure/`, `docker/`, `scripts/` e `docs/`. Ajustes somente com justificativa técnica.

---

## Consequências

**Positivas:**
- Separação clara entre frontend, API, workers e extensão, com código compartilhado em `packages/`.
- TypeScript strict em todas as partes, favorecendo segurança de tipos e contratos consistentes.
- Workers BullMQ em app próprio, adequado a processos contínuos (não forçados ao modelo serverless).
- Reuso de tipos e schemas entre web, api e extensão.

**Negativas / custos:**
- Monorepositório exige configuração de ferramentas de workspace e cuidado com builds.
- Necessidade de decidir Jest vs. Vitest por app.
- Mais complexidade operacional do que um único app fullstack.

**Neutras:**
- A escolha de provedores gerenciados (Postgres, Redis, S3, Vercel) fica em decisões separadas.

---

## Alternativas consideradas

1. **Next.js fullstack único (deploy somente na Vercel).**
   - Prós: simplicidade de deploy e menos partes móveis.
   - Contras: inadequado para workers BullMQ persistentes (processos contínuos); risco de limites serverless para a API; acoplamento maior; contratos menos separados para a extensão.
   - Resultado: **rejeitada** como arquitetura principal.

2. **Backend e frontend em repositórios separados.**
   - Prós: isolamento total de ciclo de vida.
   - Contras: dificulta o compartilhamento de tipos/contratos e a coordenação entre agentes; a especificação sugere monorepositório.
   - Resultado: **não adotada**.

3. **Backend em outra linguagem (ex.: Java/Go).**
   - Prós: possíveis ganhos de performance.
   - Contras: divergência da stack preferencial declarada e do ecossistema Prisma/NestJS; sem justificativa técnica.
   - Resultado: **não adotada**.

---

## Decisões relacionadas

- [ADR-0002 — Isolamento por projeto](ADR-0002-isolamento-por-projeto.md)
- [ADR-0003 — Autenticação e sessões](ADR-0003-autenticacao-e-sessoes.md)

## Referências

- Especificação mestra, seções 0, 12, 13.
- [arquitetura-geral.md](../arquitetura-geral.md)
