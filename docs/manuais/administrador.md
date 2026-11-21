# Manual do Administrador

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Implementado

---

## 1. Objetivo

Orientar o usuário com perfil global **ADMINISTRADOR** no uso do QUALITY TEST: gestão de
usuários, projetos, vínculos de membros, ambientes, domínios, configuração de notificações,
IA opcional e trilha de auditoria.

O perfil global `ADMINISTRADOR` (`GlobalRole.ADMINISTRADOR`) **acessa todos os projetos**,
independentemente de vínculo. Os demais perfis dependem de vínculo ativo por projeto. Ver
[permissoes-e-isolamento.md](../architecture/permissoes-e-isolamento.md) e
[../../README.md](../../README.md).

> Documentação de arquitetura: o texto de permissões está marcado como **Planejado**, porém o
> comportamento descrito abaixo reflete o que está **realmente implementado** no código. Onde há
> divergência ou ausência de tela, o item é marcado como **PENDENTE**.

---

## 2. Pré-requisitos e acesso

1. Acesse `http://localhost:3000` (desenvolvimento) na tela **Login** (`/login`).
2. Informe e-mail e senha. A autenticação é própria, via `Authorization: Bearer <accessToken>`
   (sem cookies).
3. Após o login você é direcionado ao **Dashboard** (`/dashboard`).

O primeiro administrador é criado pelo *seed* de desenvolvimento
(`SEED_ADMIN_PASSWORD`). A gestão de usuários e projetos é restrita ao `ADMINISTRADOR`.

---

## 3. Navegação geral

A barra lateral (`SidebarNav`) apresenta: **Dashboard**, **Projetos**, **Ocorrências**,
**Perfil** e — somente para administradores — **Usuários** (`/users`).

Telas existentes no front-end (`apps/web`):

| Rota | Tela |
|---|---|
| `/login` | Login |
| `/forgot-password` | Solicitação de redefinição de senha |
| `/reset-password` | Redefinição de senha via token |
| `/dashboard` | Dashboard de indicadores |
| `/projects` | Lista/seletor de projetos |
| `/projects/new` | Cadastro de projeto (somente administrador) |
| `/projects/[projectId]` | Detalhe do projeto (abas Dados, Membros, Ambientes, Domínios) |
| `/occurrences` | Lista de ocorrências |
| `/occurrences/new` | Cadastro de ocorrência |
| `/occurrences/[occurrenceId]` | Detalhe da ocorrência |
| `/profile` | Perfil do usuário |
| `/users` | Gestão de usuários (somente administrador) |

---

## 4. Gestão de usuários

Tela: **Usuários** (`/users`) — visível apenas para `ADMINISTRADOR`.

### 4.1 Criar usuário

1. Clique em **Novo usuário**.
2. Preencha: **Nome**, **E-mail**, **Senha inicial** (mínimo 8 caracteres).
3. Escolha o **Perfil global** (opcional — apenas `ADMINISTRADOR` ou “Sem perfil global”) e o
   **Status** (`ATIVO`/`INATIVO`).
4. Clique em **Criar usuário**. Endpoint: `POST /api/users` (somente administrador).

### 4.2 Ativar/desativar

Na lista, use o botão **Ativar**/**Desativar** da coluna de ações. Endpoint:
`PATCH /api/users/:id/status` (somente administrador). Não é possível desativar a própria conta
(o botão fica desabilitado para o usuário logado).

### 4.3 Editar dados

- O próprio administrador edita seus dados em **Perfil** (`/profile`) — nome sempre; e-mail
  apenas para administradores (endpoint `PATCH /api/users/:id`).
- **PENDENTE:** não há tela na interface para editar nome/e-mail de **outro** usuário. A API
  (`PATCH /api/users/:id`) permite, mas não há formulário dedicado para isso na web.

---

## 5. Gestão de projetos

### 5.1 Criar projeto

1. Em **Projetos** (`/projects`), clique em **Novo projeto** (visível apenas para administrador).
2. Preencha **Nome**, **Código** (somente letras maiúsculas, números e hífen — ex.:
   `INTRANET-MARICA`), **Descrição** e **Status** inicial (`ATIVO`/`INATIVO`).
3. Clique em **Criar projeto**. Endpoint: `POST /api/projects` (somente administrador).

### 5.2 Editar projeto

No **Detalhe do projeto** (`/projects/[projectId]`), aba **Dados**, edite **Nome**, **Código** e
**Descrição** e clique em **Salvar alterações**. Endpoint: `PATCH /api/projects/:projectId`
(administrador **ou** `GESTOR` do projeto).

### 5.3 Ativar/desativar projeto

- Endpoint existente: `PATCH /api/projects/:projectId/status` (somente administrador).
- **PENDENTE:** não há botão de ativar/desativar projeto na interface web. Hoje a alteração de
  status só é possível pela API.

### 5.4 Definir projeto ativo

No detalhe do projeto, use **Definir como ativo**. O projeto ativo define o escopo das telas de
Ocorrências e Dashboard. A seleção é lembrada por usuário no navegador.

---

## 6. Vínculos de membros e papéis

No **Detalhe do projeto**, aba **Membros**.

### 6.1 Adicionar membro

1. Selecione o **Usuário** (administrador vê uma lista de usuários; `GESTOR` digita o
   identificador/UUID) e o **Papel** (`GESTOR`, `TESTADOR`, `DESENVOLVEDOR`).
2. Clique em **Adicionar**. Endpoint: `POST /api/projects/:projectId/members`
   (`ADMINISTRADOR` ou `GESTOR`).

### 6.2 Alterar papel

Na lista de membros, altere o seletor da coluna **Papel**. Endpoint:
`PATCH /api/projects/:projectId/members/:userId`.

### 6.3 Desativar vínculo

Use o botão **Desativar** na linha do membro (com confirmação). Endpoint:
`DELETE /api/projects/:projectId/members/:userId` (desativação lógica).

---

## 7. Ambientes

No **Detalhe do projeto**, aba **Ambientes**.

1. **Novo ambiente**: informe **Nome**, **URL base** (com protocolo), **Tipo**
   (`DEVELOPMENT`/`TESTING`/`STAGING`/`PRODUCTION`) e **Status**. Endpoint:
   `POST /api/projects/:projectId/environments`.
2. **Editar**: abre o modal preenchido (`PATCH .../environments/:environmentId`).
3. **Desativar**: desativação lógica (`DELETE .../environments/:environmentId`).

Criação/edição/desativação exigem `ADMINISTRADOR` ou `GESTOR` do projeto. A listagem é liberada a
membro ativo ou administrador.

---

## 8. Domínios

No **Detalhe do projeto**, aba **Domínios**. O mapeamento associa um domínio/padrão de URL a um
**ambiente do mesmo projeto** (usado na sugestão de projeto pela extensão).

1. **Novo domínio**: informe **Domínio / padrão** (ex.: `homolog.exemplo.com`), **Ambiente** e o
   flag **Habilitado**. Endpoint: `POST /api/projects/:projectId/domains`.
2. **Editar**: `PATCH .../domains/:mappingId`.
3. **Remover**: `DELETE .../domains/:mappingId` (com confirmação).

Exigem `ADMINISTRADOR` ou `GESTOR` do projeto.

---

## 9. Configuração de notificações

O backend implementa destinos, regras e histórico de entregas por projeto
(`/api/projects/:projectId/notifications/...`) e o reprocessamento administrativo
(`POST /api/notifications/deliveries/:deliveryId/reprocess`, somente administrador).

- Configuração (destinos/regras) restrita a `GESTOR` do projeto ou `ADMINISTRADOR`; consulta
  liberada a membro ativo.
- Destinos são criados **desabilitados por padrão** e não guardam segredos (apenas a lista
  permitida de chaves do canal).
- **Canal WhatsApp: DESATIVADO** por ausência de credenciais oficiais da Meta. Nenhuma mensagem é
  enviada; as entregas são registradas como descartadas/desabilitadas. Canais `EMAIL`/`TEAMS`
  também não estão conectados.
- **PENDENTE:** não há tela web de configuração/histórico de notificações. A configuração hoje é
  feita diretamente pela API. Detalhes em
  [notificacoes-whatsapp.md](../architecture/notificacoes-whatsapp.md).

---

## 10. IA opcional

- O módulo de IA é **desativado por padrão** (`AI_ENABLED=false`). Sem essa variável, a geração
  de sugestões responde `503`.
- O provedor padrão é o **local determinístico** (`AI_PROVIDER=local`), sem rede e sem
  credenciais. Adaptadores externos **não estão conectados** (PENDENTE).
- Na interface, o card **Sugestões de IA** aparece no detalhe da ocorrência, com rótulo de
  conteúdo gerado por IA, provedor/modelo, confiança e motivo. Aplicar categoria/prioridade exige
  **confirmação humana** e respeita as permissões de edição.
- **PENDENTE (quanto à gestão):** não existe tela administrativa para “ativar/desativar” a IA. O
  estado é controlado **exclusivamente pelas variáveis de ambiente** `AI_ENABLED` e `AI_PROVIDER`.
  Detalhes em [ia-opcional.md](../architecture/ia-opcional.md).

---

## 11. Trilha de auditoria

- As decisões de acesso e as alterações de domínio são registradas no backend (`AuditLog` e o
  histórico da ocorrência).
- **Histórico da ocorrência:** visível no detalhe da ocorrência (`/occurrences/[occurrenceId]`),
  card **Histórico**, com ação, autor, data e valores anterior/novo. Endpoint:
  `GET /api/occurrences/:occurrenceId/history`.
- **PENDENTE:** não há tela de **Auditoria global** implementada na interface web (a tela 17 do
  sitemap é planejada). A consulta hoje é apenas via API/banco.

---

## 12. Resumo de permissões do administrador

| Operação | Interface | Endpoint |
|---|---|---|
| Criar/listar usuários, ativar/desativar | Sim (`/users`) | `/api/users` |
| Criar projeto | Sim (`/projects/new`) | `POST /api/projects` |
| Editar projeto | Sim (aba Dados) | `PATCH /api/projects/:projectId` |
| Ativar/desativar projeto | **PENDENTE (API)** | `PATCH /api/projects/:projectId/status` |
| Membros (adicionar/papel/desativar) | Sim (aba Membros) | `/api/projects/:projectId/members` |
| Ambientes | Sim (aba Ambientes) | `/api/projects/:projectId/environments` |
| Domínios | Sim (aba Domínios) | `/api/projects/:projectId/domains` |
| Notificações | **PENDENTE (API)** | `/api/projects/:projectId/notifications` |
| Reprocessar entrega | **PENDENTE (API)** | `/api/notifications/deliveries/:id/reprocess` |
| IA (ativar/desativar) | **PENDENTE (env)** | variáveis `AI_ENABLED`/`AI_PROVIDER` |
| Auditoria global | **PENDENTE** | — |

---

## 13. Pendências conhecidas

- Tela de ativar/desativar projeto.
- Tela de edição de dados de outros usuários.
- Telas de configuração e histórico de notificações.
- Tela de auditoria global.
- Controle de IA pela interface (hoje apenas por variáveis de ambiente).
- Sem envio de e-mail na redefinição de senha: o token é persistido e o evento auditado, mas
  **não há provedor de e-mail** — o usuário não recebe instruções automaticamente.

---

## 14. Referências

- [../../README.md](../../README.md)
- [../architecture/permissoes-e-isolamento.md](../architecture/permissoes-e-isolamento.md)
- [../architecture/sitemap-e-telas.md](../architecture/sitemap-e-telas.md)
- [../architecture/notificacoes-whatsapp.md](../architecture/notificacoes-whatsapp.md)
- [../architecture/ia-opcional.md](../architecture/ia-opcional.md)
