# Contratos da API REST

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Planejado (não implementado)

---

## 1. Objetivo e convenções

Documentar os contratos principais da API REST do QUALITY TEST, agrupados por recurso. Fiel à seção 12 (REST API + Swagger/OpenAPI) e ao modelo de dados da seção 11.

> **Todos os endpoints são Planejados.** Não existe implementação. Os exemplos de payload são ilustrativos e não representam dados reais.

**Convenções gerais:**

| Item | Definição |
|---|---|
| Base URL | Definida no deploy — **PENDENTE DE DEFINIÇÃO** (ex.: `/api/v1`) |
| Autenticação | Bearer token (access token) no header `Authorization: Bearer <token>` |
| Autorização | Toda rota dependente de projeto valida `ProjectMember` no backend |
| Formato | JSON UTF-8 |
| Erros | Código HTTP + corpo `{ "statusCode", "error", "message", "timestamp", "path" }` |
| Paginação | `?page=1&pageSize=20` (padrão a confirmar — PENDENTE DE DEFINIÇÃO) |
| Idempotência | Header `Idempotency-Key` em operações de criação sensíveis (ocorrências) |
| Documentação | Swagger/OpenAPI gerado pelo NestJS |

**Códigos de status usados:** 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500.

---

## 2. /auth

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| POST | `/auth/login` | Autentica e emite access token + refresh session | Público |
| POST | `/auth/refresh` | Renova o access token via refresh token | Sessão válida (refresh) |
| POST | `/auth/logout` | Encerra a sessão (revoga refresh session) | Autenticado |
| POST | `/auth/forgot-password` | Solicita recuperação de senha | Público |
| POST | `/auth/reset-password` | Redefine a senha via token | Público (token) |
| POST | `/auth/change-password` | Altera a senha do usuário autenticado | Autenticado |

**Exemplo — POST /auth/login**

Request:
```json
{
  "email": "usuario@exemplo.invalid",
  "password": "********"
}
```

Response 200:
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-token>",
  "expiresIn": 900,
  "user": {
    "id": "usr_0001",
    "name": "Nome de Exemplo",
    "email": "usuario@exemplo.invalid"
  }
}
```

---

## 3. /users

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/users` | Lista usuários (paginado) | ADMINISTRADOR |
| POST | `/users` | Cria usuário | ADMINISTRADOR |
| GET | `/users/:id` | Consulta usuário | ADMINISTRADOR (ou o próprio) |
| PATCH | `/users/:id` | Edita dados do usuário | ADMINISTRADOR (ou o próprio, campos limitados) |
| PATCH | `/users/:id/status` | Ativa/desativa usuário | ADMINISTRADOR |
| GET | `/users/me` | Perfil do usuário autenticado | Autenticado |
| GET | `/users/:id/projects` | Projetos dos quais o usuário participa | ADMINISTRADOR (ou o próprio) |

**Exemplo — POST /users**

Request:
```json
{
  "name": "Nome de Exemplo",
  "email": "testador@exemplo.invalid",
  "role": "TESTADOR",
  "status": "ATIVO"
}
```

Response 201:
```json
{
  "id": "usr_0002",
  "name": "Nome de Exemplo",
  "email": "testador@exemplo.invalid",
  "status": "ATIVO",
  "createdAt": "2026-11-21T12:00:00Z"
}
```

> A senha inicial e o fluxo de convite dependem de decisão de produto (seção 3.1) — PENDENTE DE DEFINIÇÃO.

---

## 4. /projects

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/projects` | Lista projetos visíveis ao usuário | Autenticado (escopo por vínculo) |
| POST | `/projects` | Cria projeto | ADMINISTRADOR (GESTOR condicionado) |
| GET | `/projects/:id` | Consulta projeto | Membro do projeto ou ADMINISTRADOR |
| PATCH | `/projects/:id` | Edita projeto | ADMINISTRADOR (GESTOR condicionado) |
| PATCH | `/projects/:id/status` | Ativa/desativa projeto | ADMINISTRADOR |

**Exemplo — POST /projects**

Request:
```json
{
  "name": "Intranet Maricá",
  "code": "INTRANET-MARICA",
  "description": "Sistema de exemplo",
  "status": "ATIVO"
}
```

Response 201:
```json
{
  "id": "prj_0001",
  "name": "Intranet Maricá",
  "code": "INTRANET-MARICA",
  "status": "ATIVO",
  "createdAt": "2026-11-21T12:00:00Z"
}
```

> `Intranet Maricá` e `Portal da Tecnologia` são apenas exemplos de cadastro (seção 4). URLs reais são configuráveis pelo administrador.

---

## 5. /projects/:id/members

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/projects/:id/members` | Lista membros do projeto | Membro do projeto ou ADMINISTRADOR |
| POST | `/projects/:id/members` | Adiciona membro | ADMINISTRADOR (GESTOR condicionado) |
| PATCH | `/projects/:id/members/:memberId` | Altera papel/status do vínculo | ADMINISTRADOR (GESTOR condicionado) |
| DELETE | `/projects/:id/members/:memberId` | Remove membro (desativa vínculo) | ADMINISTRADOR (GESTOR condicionado) |

**Exemplo — POST /projects/prj_0001/members**

Request:
```json
{
  "userId": "usr_0002",
  "role": "TESTADOR",
  "status": "ATIVO"
}
```

Response 201:
```json
{
  "id": "pm_0001",
  "projectId": "prj_0001",
  "userId": "usr_0002",
  "role": "TESTADOR",
  "status": "ATIVO",
  "addedBy": "usr_0001",
  "createdAt": "2026-11-21T12:00:00Z"
}
```

---

## 6. /projects/:id/environments

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/projects/:id/environments` | Lista ambientes | Membro do projeto ou ADMINISTRADOR |
| POST | `/projects/:id/environments` | Cria ambiente | ADMINISTRADOR (GESTOR condicionado) |
| PATCH | `/projects/:id/environments/:envId` | Edita ambiente | ADMINISTRADOR (GESTOR condicionado) |
| PATCH | `/projects/:id/environments/:envId/status` | Ativa/desativa ambiente | ADMINISTRADOR |

**Exemplo — POST /projects/prj_0001/environments**

Request:
```json
{
  "name": "Homologação",
  "baseUrl": "https://homolog.exemplo.invalid",
  "type": "staging",
  "status": "ATIVO"
}
```

Response 201:
```json
{
  "id": "env_0001",
  "projectId": "prj_0001",
  "name": "Homologação",
  "type": "staging",
  "status": "ATIVO"
}
```

---

## 7. /projects/:id/domains

Mapeamento de domínio/URL para sugestão de projeto na extensão (seção 6.2).

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/projects/:id/domains` | Lista mapeamentos de domínio | Membro do projeto ou ADMINISTRADOR |
| POST | `/projects/:id/domains` | Cria mapeamento | ADMINISTRADOR (GESTOR condicionado) |
| PATCH | `/projects/:id/domains/:domainId` | Edita/habilita/desabilita | ADMINISTRADOR (GESTOR condicionado) |

**Exemplo — POST /projects/prj_0001/domains**

Request:
```json
{
  "domainPattern": "homolog.exemplo.invalid",
  "environmentId": "env_0001",
  "enabled": true
}
```

Response 201:
```json
{
  "id": "dom_0001",
  "projectId": "prj_0001",
  "domainPattern": "homolog.exemplo.invalid",
  "environmentId": "env_0001",
  "enabled": true
}
```

### 7.1 Endpoint de sugestão (extensão)

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/projects/suggest?url=<url>` | Sugere projeto por domínio/URL | Autenticado |

Response 200 (sugestão **sempre confirmável**, nunca aplicada silenciosamente):
```json
{
  "suggestions": [
    { "projectId": "prj_0001", "name": "Intranet Maricá", "confidence": "alta" }
  ],
  "ambiguous": false
}
```

> Se `ambiguous = true`, a extensão exige seleção manual pelo usuário.

---

## 8. /occurrences

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/occurrences` | Lista ocorrências (filtros + paginação, sempre por projeto autorizado) | Autenticado (escopo por projeto) |
| POST | `/occurrences` | Cria ocorrência (**requer `Idempotency-Key`**) | Membro do projeto com permissão de registro |
| GET | `/occurrences/:id` | Detalhes da ocorrência | Membro do projeto da ocorrência |
| PATCH | `/occurrences/:id` | Edita campos da ocorrência | Permissão conforme matriz |
| PATCH | `/occurrences/:id/status` | Altera status (transição controlada) | Permissão conforme fluxo |
| PATCH | `/occurrences/:id/assignee` | Atribui/reatribui responsável | GESTOR/ADMINISTRADOR |
| POST | `/occurrences/:id/cancel` | Cancela ocorrência | GESTOR/ADMINISTRADOR |
| GET | `/occurrences/export` | Exporta ocorrências (respeitando permissões) | Permissão de exportação |

**Filtros de `GET /occurrences`:** `projectId` (obrigatório no escopo), `environmentId`, `categoryId`, `priority`, `status`, `assigneeUserId`, `reporterUserId`, `from`, `to`, `q` (busca por código/título/descrição), `page`, `pageSize`, `sort`.

### 8.1 Criação de ocorrência com Idempotency-Key

O header `Idempotency-Key` previne duplicidade em reenvio (seções 5.5 e 6.5). A chave é única por requisição; reenvios com a mesma chave retornam o mesmo resultado.

**Exemplo — POST /occurrences**

Headers:
```http
Authorization: Bearer <token>
Idempotency-Key: 3f2a1c9e-8b7d-4a6f-9c1e-2d0b5a7f1234
Content-Type: application/json
```

Request:
```json
{
  "projectId": "prj_0001",
  "environmentId": "env_0001",
  "title": "Componente desalinhado na página de cadastro",
  "description": "Ao abrir a página de cadastro em viewport reduzido, o botão de salvar fica fora da área visível.",
  "categoryId": "cat_visual",
  "priority": "ALTA",
  "pageUrl": "https://homolog.exemplo.invalid/cadastro",
  "pageTitle": "Cadastro",
  "browserInfo": "navegador/versão (quando disponível)",
  "operatingSystemInfo": "SO (quando disponível)",
  "viewportInfo": "dimensões (quando disponível)",
  "attachmentIds": ["att_0001"]
}
```

> O campo `reporterUserId` **não é aceito** no request: o autor é atribuído pelo servidor a partir da sessão autenticada (seção 3.3).

Response 201:
```json
{
  "id": "occ_0001",
  "publicCode": "QT-000125",
  "projectId": "prj_0001",
  "title": "Componente desalinhado na página de cadastro",
  "priority": "ALTA",
  "status": "ABERTO",
  "reporterUserId": "usr_0002",
  "createdAt": "2026-11-21T12:00:00Z"
}
```

Response 409 (conflito de idempotência já processada com corpo diferente) ou 200 com o recurso previamente criado — regra a confirmar **PENDENTE DE DEFINIÇÃO**.

---

## 9. Comentários

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/occurrences/:id/comments` | Lista comentários | Membro do projeto |
| POST | `/occurrences/:id/comments` | Adiciona comentário | Membro do projeto com permissão |
| PATCH | `/occurrences/:id/comments/:commentId` | Edita comentário | Autor ou ADMINISTRADOR |

**Exemplo — POST /occurrences/occ_0001/comments**

Request:
```json
{ "content": "Reproduzido em homologação; segue evidência em anexo." }
```

Response 201:
```json
{
  "id": "cmt_0001",
  "occurrenceId": "occ_0001",
  "userId": "usr_0002",
  "content": "Reproduzido em homologação; segue evidência em anexo.",
  "createdAt": "2026-11-21T12:05:00Z"
}
```

---

## 10. Anexos

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| POST | `/occurrences/:id/attachments` | Solicita upload (gera URL assinada) | Membro do projeto com permissão |
| GET | `/occurrences/:id/attachments/:attId/url` | Gera URL assinada de download | Membro do projeto |
| DELETE | `/occurrences/:id/attachments/:attId` | Remove anexo | Autor/GESTOR/ADMINISTRADOR |

**Exemplo — POST /occurrences/occ_0001/attachments**

Request:
```json
{ "fileName": "screenshot.png", "mimeType": "image/png", "size": 204800 }
```

Response 201:
```json
{
  "id": "att_0001",
  "uploadUrl": "<url-assinada-com-expiracao>",
  "storageKey": "occurrences/occ_0001/screenshot.png"
}
```

> Validação de MIME type, extensão e tamanho. Varredura de arquivos quando viável (seção 12).

---

## 11. Histórico

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/occurrences/:id/history` | Histórico cronológico de alterações | Membro do projeto |

**Exemplo — response 200**
```json
{
  "items": [
    {
      "id": "hst_0001",
      "action": "STATUS_CHANGED",
      "previousValue": "EM_ANALISE",
      "newValue": "EM_DESENVOLVIMENTO",
      "actorUserId": "usr_0003",
      "createdAt": "2026-11-21T13:00:00Z"
    }
  ]
}
```

---

## 12. /notifications/*

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/projects/:id/notifications/destinations` | Lista destinos | Membro do projeto (gestão: ADMINISTRADOR/GESTOR) |
| POST | `/projects/:id/notifications/destinations` | Cria destino | ADMINISTRADOR (GESTOR condicionado) |
| PATCH | `/projects/:id/notifications/destinations/:destId` | Edita/habilita destino | ADMINISTRADOR (GESTOR condicionado) |
| GET | `/projects/:id/notifications/rules` | Lista regras | Membro do projeto |
| POST | `/projects/:id/notifications/rules` | Cria regra | ADMINISTRADOR (GESTOR condicionado) |
| GET | `/projects/:id/notifications/deliveries` | Histórico de entregas | Membro do projeto (com permissão) |
| POST | `/notifications/deliveries/:id/reprocess` | Reprocessa entrega (administrativo) | ADMINISTRADOR |

> `destinationConfig` **nunca** retorna segredos em texto aberto. O canal WhatsApp permanece **desativado** até haver credenciais oficiais (ver [notificacoes-whatsapp.md](notificacoes-whatsapp.md)).

**Exemplo — POST /projects/prj_0001/notifications/destinations**

Request:
```json
{
  "channel": "whatsapp",
  "destinationConfig": { "recipientRef": "<referencia>", "template": "occurrence_created" },
  "enabled": false
}
```

---

## 13. /audit

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/audit` | Lista eventos de auditoria (filtros) | ADMINISTRADOR (GESTOR condicionado ao projeto) |
| GET | `/audit/:id` | Detalhe de evento | ADMINISTRADOR |

**Filtros:** `projectId`, `actorUserId`, `entityType`, `entityId`, `action`, `from`, `to`.

> Auditoria não editável por usuários comuns (seção 10).

---

## 14. /reports

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/reports/summary` | Indicadores gerais (escopo por acesso) | Autenticado (escopo por projeto) |
| GET | `/reports/by-project` | Ocorrências por projeto autorizado | Autenticado |
| GET | `/reports/by-status` | Distribuição por status | Autenticado |
| GET | `/reports/by-priority` | Distribuição por prioridade | Autenticado |
| GET | `/reports/by-category` | Distribuição por categoria | Autenticado |
| GET | `/reports/by-assignee` | Ocorrências por responsável | Autenticado |
| GET | `/reports/by-reporter` | Ocorrências por autor | Autenticado |
| GET | `/reports/resolution-time` | Tempo médio de resolução | Autenticado |
| GET | `/reports/evolution` | Evolução por período | Autenticado |
| GET | `/reports/rejection-rate` | Taxa de reprovação na homologação | Autenticado |

> Todos os indicadores respeitam o escopo de acesso. Não misturar dados de projetos sem acesso (seção 9).

**Exemplo — GET /reports/summary?projectId=prj_0001**
```json
{
  "projectId": "prj_0001",
  "total": 128,
  "byStatus": { "ABERTO": 20, "EM_ANALISE": 15, "EM_DESENVOLVIMENTO": 30, "AGUARDANDO_HOMOLOGACAO": 18, "REPROVADO_NA_HOMOLOGACAO": 5, "CONCLUIDO": 35, "CANCELADO": 5 },
  "avgResolutionHours": 72.5,
  "rejectionRate": 0.12
}
```

---

## 15. /ai (IA opcional)

Módulo **opcional**, desacoplado e configurável (seção 8). IA é assistiva e **nunca** altera a ocorrência automaticamente: aplicar uma sugestão é uma ação humana via `PATCH /occurrences/:occurrenceId`. Desativado por padrão (`AI_ENABLED=false`) — quando desativado, a geração responde **`503`** e a listagem retorna `enabled: false`. Ver [ia-opcional.md](ia-opcional.md).

**Implementado (Etapa 9):**

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| GET | `/occurrences/:occurrenceId/ai-analyses` | Lista as análises registradas da ocorrência | Membro ativo do projeto (ou ADMINISTRADOR) |
| POST | `/occurrences/:occurrenceId/ai-analyses` | Gera novas sugestões e registra a análise (auditoria) | Membro ativo do projeto (ou ADMINISTRADOR) |

Aplicar as sugestões usa os endpoints já existentes: `PATCH /occurrences/:occurrenceId` com `{ "categoryId": ... }` (permissão de edição) ou `{ "priority": ... }` (permissão de alterar prioridade).

**Exemplo — POST /occurrences/occ_0001/ai-analyses (201)**

```json
{
  "id": "aia_0001",
  "occurrenceId": "occ_0001",
  "provider": "local-deterministic",
  "model": "heuristic-v1",
  "suggestions": [
    { "type": "RESUMO", "value": "Ao salvar o cadastro, a API retorna erro 500.", "confidence": 0.5, "rationale": "Resumo derivado da descrição (heurística local determinística)." },
    { "type": "CATEGORIA", "value": "ERRO_INTEGRACAO", "confidence": 0.7, "rationale": "Palavras-chave identificadas: api." },
    { "type": "DUPLICIDADE", "value": "QT-000125", "confidence": 0.6, "rationale": "Título semelhante ao da ocorrência QT-000125." }
  ],
  "createdAt": "2026-11-21T12:00:00.000Z"
}
```

**Exemplo — GET /occurrences/occ_0001/ai-analyses (200) com módulo desativado**

```json
{ "enabled": false, "provider": "disabled", "model": "none", "items": [] }
```

**Planejado (não implementado — adaptador externo futuro):**

| Método | Caminho | Descrição | Permissão exigida |
|---|---|---|---|
| POST | `/ai/suggest/title` | Sugere título a partir da descrição | Autenticado (se IA habilitada) |
| POST | `/ai/suggest/category` | Sugere categoria | Autenticado |
| POST | `/ai/suggest/priority` | Sugere prioridade | Autenticado |
| POST | `/ai/suggest/summary` | Resume descrição extensa | Autenticado |
| GET | `/ai/similar?occurrenceId=...` | Encontra ocorrências potencialmente duplicadas | Membro do projeto |

> Não enviar screenshots ou dados sensíveis a provedores externos sem configuração, base legal e controles adequados. Registrar provedor/modelo, sem segredos. O provedor local determinístico não acessa a rede.

---

## 16. Erros padronizados

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Usuário não possui acesso ao projeto informado.",
  "timestamp": "2026-11-21T12:00:00Z",
  "path": "/occurrences"
}
```

| Código | Uso |
|---|---|
| 400 | Payload inválido |
| 401 | Sessão ausente/inválida |
| 403 | Sem vínculo/permissão no projeto |
| 404 | Recurso inexistente (ou não acessível) |
| 409 | Conflito de unicidade / idempotência |
| 422 | Regra de negócio violada (ex.: transição de status inválida) |
| 429 | Rate limit excedido |
| 500 | Erro interno (sem vazar detalhes sensíveis) |
| 503 | Módulo opcional desativado (ex.: IA com `AI_ENABLED=false`) |

---

## 17. Referências

- Especificação mestra, seções 3, 4, 5, 6, 7, 8, 9, 10, 11, 12.
- [permissoes-e-isolamento.md](permissoes-e-isolamento.md)
- [modelo-de-dados.md](modelo-de-dados.md)
- [ia-opcional.md](ia-opcional.md)
- [notificacoes-whatsapp.md](notificacoes-whatsapp.md)
