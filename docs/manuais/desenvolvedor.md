# Manual do Desenvolvedor

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Implementado

---

## 1. Objetivo

Orientar o usuário com papel de projeto **DESENVOLVEDOR** (`ProjectRole.DESENVOLVEDOR`) no
QUALITY TEST: ver as ocorrências atribuídas, comentar e alterar o status conforme as transições
permitidas.

O `DESENVOLVEDOR` atua **por projeto**, apenas nos projetos em que possui vínculo **ATIVO**.
Detalhes em [permissoes-e-isolamento.md](../architecture/permissoes-e-isolamento.md).

---

## 2. Acesso

1. Faça login em `/login`.
2. Selecione o **projeto ativo** no seletor do topo (apenas projetos com vínculo ativo).
3. Acesse **Ocorrências** (`/occurrences`).

---

## 3. Ver ocorrências atribuídas

Na lista (`/occurrences`), use o filtro **Responsável** para selecionar **você mesmo** e ver o que
está atribuído a você. Também é possível filtrar por **Status**, **Prioridade**, **Categoria**,
período (**De/Até**), buscar por código/título/descrição e ordenar.

Colunas: **Código**, **Título**, **Categoria**, **Prioridade**, **Status** e **Criada em**.

> **PENDENTE:** não existe uma tela dedicada “Minhas ocorrências”. O acompanhamento é feito pelo
> filtro de responsável na lista padrão.

Clique em uma linha para abrir o **detalhe** (`/occurrences/[occurrenceId]`), onde constam
descrição, detalhes, anexos, comentários, sugestões de IA, histórico e ações.

---

## 4. Comentar

No detalhe, card **Comentários**:

1. Escreva o texto em **Novo comentário**.
2. Clique em **Comentar** (`POST /api/occurrences/:occurrenceId/comments`).

Você pode **editar**/**remover** os **seus próprios** comentários. Registre aqui a análise técnica
do defeito.

---

## 5. Anexos

No card **Anexos** do detalhe, selecione um arquivo para enviar (o upload usa URL assinada). Você
também pode **baixar** anexos existentes. A remoção de anexos de terceiros é restrita a autor,
`GESTOR` ou administrador.

---

## 6. Alterar status (transições permitidas)

No detalhe, card **Ações** → **Alterar status**. Somente as transições permitidas para o seu papel
são exibidas:

| De | Para | Justificativa |
|---|---|---|
| ABERTO | EM_ANALISE | Não |
| EM_ANALISE | EM_DESENVOLVIMENTO | Não |
| EM_DESENVOLVIMENTO | AGUARDANDO_HOMOLOGACAO | Não |
| AGUARDANDO_HOMOLOGACAO | CONCLUIDO | Não |
| AGUARDANDO_HOMOLOGACAO | REPROVADO_HOMOLOGACAO | Sim |
| REPROVADO_HOMOLOGACAO | EM_DESENVOLVIMENTO | Não |

1. Escolha o status de destino.
2. Se a transição exigir, preencha a **Justificativa** (obrigatória).
3. Clique em **Aplicar status**. Endpoint: `PATCH /api/occurrences/:occurrenceId/status`.

> **Cancelar** uma ocorrência (transições para `CANCELADO`) é exclusivo do `GESTOR`/administrador —
> **não** aparece para o `DESENVOLVEDOR`. `CONCLUIDO` e `CANCELADO` são estados finais.

---

## 7. IA opcional

Se habilitada no ambiente (`AI_ENABLED=true`), o card **Sugestões de IA** permite gerar sugestões
(resumo, categoria, prioridade, duplicidade). As sugestões são **assistivas**: aplicar categoria/
prioridade exige **confirmação humana**. O `DESENVOLVEDOR` pode aplicar **prioridade** (permissão
de alterar prioridade) e categoria (permissão de edição). Quando desativada, o card informa que o
módulo está desativado. Detalhes em [ia-opcional.md](../architecture/ia-opcional.md).

---

## 8. O que o DESENVOLVEDOR pode e não pode

| Ação | Permitido |
|---|---|
| Ver ocorrências do projeto (vínculo ativo) | Sim |
| Comentar (e moderar os próprios) | Sim |
| Anexar evidências | Sim |
| Alterar status (transições da tabela acima) | Sim |
| Alterar prioridade | Sim |
| Atribuir responsável | Não (GESTOR/administrador) |
| Cancelar ocorrência | Não |
| Gerenciar membros/ambientes/domínios | Não |
| Administrar usuários/projetos | Não |

---

## 9. Pendências conhecidas

- Sem tela dedicada “Minhas ocorrências” (usar filtro de responsável).
- Sem formulário de edição de título/descrição na interface (apenas via API).
- Provedor de IA externo não conectado (apenas provedor local determinístico, desativado por
  padrão).

---

## 10. Referências

- [../../README.md](../../README.md)
- [../architecture/permissoes-e-isolamento.md](../architecture/permissoes-e-isolamento.md)
- [../architecture/ia-opcional.md](../architecture/ia-opcional.md)
