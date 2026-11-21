# ADR-0003 — Autenticação e Sessões

**Versão:** 1.0
**Data:** 21/11/2026
**Status do documento:** Implementado
**Status do ADR:** Aceito
**Contexto da decisão:** ETAPA 1 — Diagnóstico e Arquitetura

---

## Contexto

A especificação exige autenticação com login/logout, recuperação e redefinição de senha, alteração de senha e **gestão de sessões** (seção 3.1). O modelo de dados (seção 11) sugere uma entidade **`RefreshSession`** com `id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt` e `createdAt` — ou seja, um refresh token armazenado apenas como **hash** no banco.

A extensão Chrome precisa usar a sessão autenticada do Quality Test, com **expiração e renovação segura de sessão** (seção 6.4), e o backend deve determinar o usuário pelo token/sessão validado (seção 3.3).

É necessário decidir entre implementar autenticação própria ou adotar um provedor gerenciado. A decisão impacta ETAPA 3 (Autenticação e Autorização) e a extensão (ETAPA 7).

---

## Decisão

Adotar **autenticação própria** baseada na estrutura já prevista pela especificação:

- **Access token (JWT)** de curta duração.
- **Refresh token opaco** persistido como **hash** na entidade `RefreshSession` (`tokenHash`), com `expiresAt`, `revokedAt` e possibilidade de revogação.
- Senhas armazenadas apenas como **hash** com algoritmo apropriado (nunca em texto puro).
- Rotação/renovação de refresh token e revogação em logout/gestão de sessões.
- Autorização combinada com RBAC e permissões por projeto (ver [ADR-0002](ADR-0002-isolamento-por-projeto.md)).
- CORS restrito, rate limiting e headers de segurança.

> Esta é a alternativa **proposta**. A adoção de um provedor gerenciado permanece registrada como alternativa (abaixo) e pode ser reconsiderada se surgirem requisitos de SSO corporativo — **PENDENTE DE DEFINIÇÃO**.

---

## Consequências

**Positivas:**
- Alinhamento direto com o modelo de dados da especificação (`RefreshSession` com `tokenHash`).
- Controle total sobre o fluxo de sessão, revogação e gestão de sessões.
- Sem dependência externa de autenticação para o funcionamento básico.
- Permite integrar a autorização por projeto de forma nativa.

**Negativas / custos:**
- Responsabilidade própria sobre segurança de credenciais, hashing, rotação e revogação.
- Necessidade de implementar e testar recuperação/redefinição de senha, e proteção contra abuso.
- Sem recursos prontos de SSO/MFA de provedores gerenciados (a menos que adicionados depois).

**Neutras:**
- Se houver exigência corporativa de SSO, uma migração parcial para provedor gerenciado pode ser avaliada.

---

## Alternativas consideradas

1. **Provedor de identidade gerenciado** (ex.: Auth0, Cognito, Clerk, Keycloak ou SSO corporativo).
   - Prós: SSO, MFA e gestão de sessões prontos; menos código sensível a manter.
   - Contras: dependência externa, custo adicional (a levantar), possível acoplamento e menos aderência ao modelo `RefreshSession` da especificação; a spec assume autenticação própria.
   - Resultado: **não adotada como principal**, mantida como alternativa para cenário de SSO corporativo — **PENDENTE DE DEFINIÇÃO**.

2. **Provedor gerenciado como autenticação primária + autorização por projeto própria.**
   - Prós: delega login/senha ao provedor; mantém RBAC/isolamento no backend.
   - Contras: mistura de responsabilidades e dependência externa desde o MVP.
   - Resultado: **não adotada nesta fase**.

3. **Sessão apenas com JWT de longa duração (sem refresh session).**
   - Prós: implementação mais simples.
   - Contras: difícil revogar; contraria a previsão de `RefreshSession` e a gestão de sessões.
   - Resultado: **rejeitada**.

> Nota: algoritmos de hash de senha, tempos de expiração e política de rotação exata serão definidos na ETAPA 3 — **PENDENTE DE DEFINIÇÃO**.

---

## Decisões relacionadas

- [ADR-0001 — Stack e monorepo](ADR-0001-stack-e-monorepo.md)
- [ADR-0002 — Isolamento por projeto](ADR-0002-isolamento-por-projeto.md)

## Referências

- Especificação mestra, seções 3.1, 3.2, 3.3, 6.4, 11, 14.
- [permissoes-e-isolamento.md](../permissoes-e-isolamento.md)
- [contratos-api.md](../contratos-api.md)
