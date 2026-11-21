# Manual do Gestor

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Implementado

---

## 1. Objetivo

Orientar o usuário com papel de projeto **GESTOR** (`ProjectRole.GESTOR`) no QUALITY TEST:
gestão de membros, ocorrências (atribuir responsável, alterar status), acompanhamento e
homologação, comentários, anexos e dashboard.

O `GESTOR` atua **por projeto**, apenas nos projetos em que possui vínculo **ATIVO**. A
autorização é sempre validada no backend. Detalhes em
[permissoes-e-isolamento.md](../architecture/permissoes-e-isolamento.md).

---

## 2. Acesso e escopo

1. Faça login em `/login` com suas credenciais.
2. Seus projetos aparecem no seletor do topo (provenientes dos seus vínculos ativos).
3. **Selecione o projeto ativo** — o escopo das telas de Ocorrências e Dashboard é o projeto
   ativo. A seleção é lembrada por usuário no navegador.

> Sem vínculo ativo em um projeto, você não acessa nem lista os dados dele (isolamento por
> projeto).

---

## 3. Gestão de membros do projeto

No **Detalhe do projeto** (`/projects/[projectId]`), aba **Membros** (habilitada para `ADMINISTRADOR`
e `GESTOR`).

### 3.1 Adicionar membro

1. Informe o **Usuário** (o `GESTOR` digita o **identificador/UUID** do usuário — apenas o
   administrador dispõe de uma lista de seleção) e escolha o **Papel**
   (`GESTOR`, `TESTADOR`, `DESENVOLVEDOR`).
2. Clique em **Adicionar**. Endpoint: `POST /api/projects/:projectId/members`.

### 3.2 Alterar papel

Na lista de membros, use o seletor da coluna **Papel** e escolha o novo papel. Endpoint:
`PATCH /api/projects/:projectId/members/:userId`.

### 3.3 Desativar vínculo

Clique em **Desativar** na linha do membro e confirme. Endpoint:
`DELETE /api/projects/:projectId/members/:userId` (desativação lógica; o histórico permanece).

---

## 4. Ocorrências — visualizar e filtrar

Tela **Ocorrências** (`/occurrences`) para o projeto ativo.

- Filtros disponíveis: **Busca** (código, título ou descrição), **Status**, **Prioridade**,
  **Categoria**, **Responsável**, período **De/Até** e **Ordenação** (mais recentes/antigas,
  atualizadas recentemente/há mais tempo).
- Colunas: **Código**, **Título**, **Categoria**, **Prioridade**, **Status**, **Criada em**.
- Clique em uma linha para abrir o detalhe (`/occurrences/[occurrenceId]`).
- Botão **Nova ocorrência** leva ao cadastro (`/occurrences/new`).

---

## 5. Atribuir responsável

No detalhe da ocorrência, card **Ações** → campo **Responsável**:

1. Selecione um **membro ativo** do projeto.
2. Clique em **Atribuir**. Endpoint: `PATCH /api/occurrences/:occurrenceId/assignee`.

A atribuição/reatribuição é permitida a `GESTOR` (e administrador). `TESTADOR` não atribui.
A atribuição é registrada no histórico da ocorrência.

---

## 6. Alterar status e homologação

No detalhe da ocorrência, card **Ações** → **Alterar status**:

1. Escolha o status de destino (apenas as transições permitidas aparecem).
2. Quando a transição exigir, informe a **Justificativa** (obrigatória).
3. Clique em **Aplicar status**. Endpoint: `PATCH /api/occurrences/:occurrenceId/status`.

### 6.1 Transições permitidas (`GESTOR`)

| De | Para | Justificativa |
|---|---|---|
| ABERTO | EM_ANALISE | Não |
| ABERTO | CANCELADO | Sim |
| EM_ANALISE | EM_DESENVOLVIMENTO | Não |
| EM_ANALISE | CANCELADO | Sim |
| EM_DESENVOLVIMENTO | AGUARDANDO_HOMOLOGACAO | Não |
| EM_DESENVOLVIMENTO | CANCELADO | Sim |
| AGUARDANDO_HOMOLOGACAO | CONCLUIDO | Não |
| AGUARDANDO_HOMOLOGACAO | REPROVADO_HOMOLOGACAO | Sim |
| REPROVADO_HOMOLOGACAO | EM_DESENVOLVIMENTO | Não |

`CONCLUIDO` e `CANCELADO` são estados finais (sem transições). O `GESTOR` é o único papel de
projeto que pode **cancelar** uma ocorrência (transições para `CANCELADO`).

> O administrador global (`actorRole = null`) é autorizado em todas as transições.

---

## 7. Comentários e anexos

- **Comentários:** no card **Comentários** do detalhe, escreva e clique em **Comentar**
  (`POST /api/occurrences/:occurrenceId/comments`). O autor pode editar/remover o próprio
  comentário; o `GESTOR` pode moderar comentários de terceiros (editar/remover).
- **Anexos:** no card **Anexos**, selecione um arquivo para enviar. O sistema solicita uma URL
  assinada (`POST /api/occurrences/:occurrenceId/attachments`) e faz o upload. Baixar gera uma URL
  assinada com expiração. O `GESTOR` pode remover anexos.

---

## 8. Dashboard e acompanhamento

Tela **Dashboard** (`/dashboard`) com escopo no **projeto ativo**: total de ocorrências e
contagens por **status**, **prioridade** e **categoria**, além dos cartões **Abertas**, **Em
desenvolvimento** e **Concluídas**.

> O checkbox **“Agregar todos os projetos visíveis”** é exclusivo do `ADMINISTRADOR`. O `GESTOR`
> visualiza apenas o projeto ativo.

Não há tela dedicada de **Relatórios/exportações** — os indicadores consolidados acima são o que
está implementado. Tela de Relatórios (item 18 do sitemap) é **PENDENTE**.

---

## 9. Notificações

A API permite configurar destinos e regras por projeto (restrito a `GESTOR`/`ADMINISTRADOR`) e
consultar o histórico de entregas. O **canal WhatsApp está DESATIVADO** (sem credenciais).

- **PENDENTE:** não há tela web de configuração/histórico de notificações; o uso é via API.
  Detalhes em [notificacoes-whatsapp.md](../architecture/notificacoes-whatsapp.md).

---

## 10. Resumo do que o GESTOR pode fazer

| Ação | Onde |
|---|---|
| Gerenciar membros (adicionar/papel/desativar) | Detalhe do projeto, aba Membros |
| Criar/editar ambientes e domínios | Detalhe do projeto (abas Ambientes/Domínios) |
| Registrar ocorrência | `/occurrences/new` |
| Atribuir responsável | Detalhe da ocorrência, card Ações |
| Alterar status/cancelar | Detalhe da ocorrência, card Ações |
| Comentar e anexar | Detalhe da ocorrência |
| Moderar comentários/anexos | Detalhe da ocorrência |
| Dashboard do projeto | `/dashboard` (escopo do projeto ativo) |

Restrições: o `GESTOR` **não** cria/lista/ativa usuários globalmente, **não** cria projetos nem
altera o status do projeto, e **não** acessa dashboard global.

---

## 11. Pendências conhecidas

- Tela de configuração/histórico de notificações (hoje via API; canal WhatsApp desativado).
- Tela de Relatórios/exportações.
- Sem formulário na interface para editar título/descrição de uma ocorrência já criada (apenas
  via API). Estão disponíveis no detalhe: atribuição, status, comentários, anexos e aplicação de
  sugestões de IA.

---

## 12. Referências

- [../../README.md](../../README.md)
- [../architecture/permissoes-e-isolamento.md](../architecture/permissoes-e-isolamento.md)
- [../architecture/sitemap-e-telas.md](../architecture/sitemap-e-telas.md)
- [../architecture/notificacoes-whatsapp.md](../architecture/notificacoes-whatsapp.md)
