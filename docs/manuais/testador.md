# Manual do Testador

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Implementado

---

## 1. Objetivo

Orientar o usuário com papel de projeto **TESTADOR** (`ProjectRole.TESTADOR`) no QUALITY TEST:
registrar ocorrências, anexar evidências/screenshot, comentar, acompanhar o status e usar a
extensão do Chrome.

O `TESTADOR` atua **por projeto**, apenas nos projetos em que possui vínculo **ATIVO**. Não eleva
privilégios nem administra usuários globalmente. Detalhes em
[permissoes-e-isolamento.md](../architecture/permissoes-e-isolamento.md).

---

## 2. Acesso

1. Faça login em `/login`.
2. Selecione o **projeto ativo** no seletor do topo (apenas projetos com vínculo ativo aparecem).
3. Vá para **Ocorrências** (`/occurrences`).

---

## 3. Registrar uma ocorrência (painel web)

Tela: **Nova ocorrência** (`/occurrences/new`), alcançável pelo botão **Nova ocorrência** na lista.

1. **Título** (obrigatório, até 200 caracteres).
2. **Descrição** (opcional, até 20000 caracteres).
3. **Categoria** (obrigatória) — ex.: `ERRO_FUNCIONAL`, `ERRO_VISUAL`, `ERRO_INTEGRACAO`,
   `ERRO_VALIDACAO`, `DESEMPENHO`, `SEGURANCA`, `ACESSIBILIDADE`, `COMPATIBILIDADE`, `OUTROS`.
4. **Prioridade** (obrigatória) — `CRITICA`, `ALTA`, `MEDIA` ou `BAIXA`.
5. **Ambiente (opcional)** — lista apenas os ambientes **ATIVOS** do projeto.
6. Seção **Informações de contexto (opcional)**: URL da página, título da página, navegador,
   sistema operacional e viewport.
7. Clique em **Registrar ocorrência**.

Ao concluir, o sistema exibe o **código público** (ex.: `QT-XXXXXX`) e abre o detalhe da ocorrência.

### 3.1 Header idempotente (`Idempotency-Key`)

O registro exige o header **`Idempotency-Key`**. A tela web **gera automaticamente** uma chave
única por submissão. Se a mesma requisição for reenviada com a mesma chave, a API **não duplica** a
ocorrência: devolve a ocorrência já criada (HTTP 200 em vez de 201).

> Endpoint: `POST /api/occurrences`. O autor é atribuído **pelo servidor** a partir da sua sessão
> (não envie `userId`/`reporterUserId` — o envio resulta em `400`).

---

## 4. Anexos e screenshot

- **No painel web:** o formulário de nova ocorrência **não** possui campo de anexo. Após criar a
  ocorrência, no **detalhe** (`/occurrences/[occurrenceId]`), card **Anexos**, selecione o arquivo
  para enviar. O sistema solicita uma URL assinada de upload e envia o binário.
- **Pela extensão do Chrome:** a captura da aba é feita ao clicar em **Capturar aba** no popup e é
  anexada automaticamente após o envio da ocorrência. Ver
  [extensao-chrome.md](extensao-chrome.md).
- O download de anexos usa URL assinada com expiração.

---

## 5. Comentar

No detalhe da ocorrência, card **Comentários**:

1. Escreva o texto em **Novo comentário**.
2. Clique em **Comentar** (`POST /api/occurrences/:occurrenceId/comments`).

Você pode **editar** e **remover** os **seus próprios** comentários. Comentários de outros
usuários não são editáveis por você (`GESTOR` e administrador podem moderar).

---

## 6. Acompanhar o status

- A lista (`/occurrences`) permite filtrar por **Status**, **Prioridade**, **Categoria**,
  **Responsável**, período e busca por código/título/descrição.
- No detalhe, os cards **Detalhes** e **Histórico** mostram autor, responsável, ambiente, datas e
  o histórico cronológico de alterações.

> O `TESTADOR` **não altera o status** nem **atribui responsável** — a mudança de status é feita
> por `GESTOR`/`DESENVOLVEDOR`. O `TESTADOR` registra, comenta e acompanha.

---

## 7. Usar a extensão do Chrome

A extensão permite registrar ocorrências enquanto você navega no sistema em teste, com captura de
screenshot. Passo a passo completo em [extensao-chrome.md](extensao-chrome.md).

Resumo: instale a extensão a partir de `apps/extension/dist`, faça login no popup, confirme o
projeto sugerido (ou selecione manualmente), capture a aba, preencha título/descrição/categoria/
prioridade e clique em **Enviar ocorrência**.

---

## 8. O que o TESTADOR não pode fazer

- Alterar o status da ocorrência.
- Atribuir/reatribuir responsável.
- Gerenciar membros, ambientes ou domínios do projeto.
- Criar/listar/administrar usuários.
- Editar o e-mail da própria conta (somente administradores alteram e-mail).
- Editar prioridade (a alteração de prioridade é de `GESTOR`/`DESENVOLVEDOR`).

---

## 9. Pendências conhecidas

- Sem formulário na interface para editar título/descrição de uma ocorrência já criada (apenas
  via API).
- A redefinição de senha não envia e-mail (não há provedor de e-mail configurado); o evento é
  apenas auditado.
- E2E de navegador (End-to-End no browser) ainda não implementado — a cobertura de interface é
  manual.

---

## 10. Referências

- [../../README.md](../../README.md)
- [../architecture/sitemap-e-telas.md](../architecture/sitemap-e-telas.md)
- [extensao-chrome.md](extensao-chrome.md)
