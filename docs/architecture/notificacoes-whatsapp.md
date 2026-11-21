# Notificações e WhatsApp

**Versão:** 1.1
**Data:** 21/11/2026
**Status:** Implementado (canal WhatsApp oficial via Cloud API integrado e **desativado por padrão** até haver credenciais)

---

## 1. Objetivo

Descrever o serviço desacoplado de notificação do QUALITY TEST, com foco no canal WhatsApp, suas responsabilidades, resiliência, adaptadores de canal e **limitações atuais**. Fiel à **seção 7** da especificação mestra.

> **Estado atual do canal WhatsApp: DESATIVADO por padrão** — a integração com a WhatsApp Business Platform / Cloud API oficial (Meta) está implementada, porém permanece inerte enquanto não houver credenciais no ambiente (ver seção 7).
> Serviço implementado na **Etapa 8** (ver seção 12).

---

## 2. Princípio fundamental

O WhatsApp é um **canal de notificação**. O registro oficial, o histórico e o ciclo de vida das ocorrências permanecem no Quality Test. A indisponibilidade do WhatsApp **não pode** impedir o cadastro ou a consulta de ocorrências (seção 1).

O componente de WhatsApp é um serviço **desacoplado do núcleo**.

---

## 3. Responsabilidades do serviço de notificação (seção 7)

- Receber evento de ocorrência criada/atualizada.
- Consultar projeto e regras de notificação.
- Preparar mensagem padronizada.
- Enviar para destinos autorizados e tecnicamente suportados.
- Registrar tentativa, resposta e status disponível.
- Tratar falhas e retentativas.
- Evitar mensagens duplicadas.
- Disponibilizar histórico de notificações.

---

## 4. Exemplo de mensagem (seção 7)

```text
QUALITY TEST — NOVA OCORRÊNCIA
Código: QT-000125
Projeto: Intranet Maricá
Categoria: Erro visual
Prioridade: Alta
Título: Componente desalinhado na página de cadastro
Registrado por: <nome do usuário>
Ambiente: Homologação
Data: <data/hora>
Acesse: <link autenticado para a ocorrência>
```

> O link para a ocorrência deve ser autenticado. Nunca incluir tokens, cookies ou segredos na mensagem.

---

## 5. Resiliência (seção 7.2)

- A ocorrência deve ser **salva antes** da tentativa de notificação.
- **Falha no WhatsApp não pode desfazer o registro.**
- Usar **fila assíncrona**.
- Implementar **retentativas com backoff**.
- Implementar **dead-letter queue (DLQ)** ou mecanismo equivalente.
- Registrar erros **sem expor tokens**.
- Permitir **reprocessamento administrativo**.
- Implementar **idempotência por evento/destino**.
- **Exibir situação da notificação.**

---

## 6. Adaptadores de canal (seção 7.3)

Criar uma **interface de canal de notificação** para permitir adicionar futuramente **e-mail, Microsoft Teams** ou outros canais, sem acoplar a regra de negócio à Meta.

```mermaid
classDiagram
    class NotificationChannel {
        <<interface>>
        +send(destination, message) DeliveryResult
        +validateConfig(config) boolean
    }
    class WhatsAppChannelAdapter {
        +send(destination, message) DeliveryResult
    }
    class EmailChannel {
        +send(destination, message) DeliveryResult
    }
    class TeamsChannel {
        +send(destination, message) DeliveryResult
    }
    NotificationChannel <|.. WhatsAppChannelAdapter
    NotificationChannel <|.. EmailChannel
    NotificationChannel <|.. TeamsChannel
```

> `WhatsAppChannelAdapter` usa a **Cloud API oficial** (`POST {graph}/{version}/{phoneNumberId}/messages`) e é **inerte** sem credenciais. `EmailChannel` e `TeamsChannel` são **planejados/futuros** e não implementados nesta versão (o registro devolve `discarded`).

---

## 7. Limitações atuais do WhatsApp

Conforme a seção 7.1, **antes de implementar qualquer fluxo** é obrigatório verificar a documentação oficial vigente:

- Elegibilidade da conta.
- Limitações de grupos.
- Regras de **templates**.
- Janela de atendimento.
- Webhooks e permissões.

**Regras explícitas:**

- Priorizar a **WhatsApp Business Platform / Cloud API oficial da Meta**.
- **Não presumir** que a API oficial permita enviar mensagens a **qualquer grupo preexistente**.
- A possibilidade de uso da **Groups API**, seus requisitos e limites deve ser **verificada diretamente na documentação oficial no momento da implementação**.
- **Não utilizar automação não oficial do WhatsApp Web** como dependência obrigatória ou caminho de produção.
- Se grupos existentes não forem suportados, oferecer alternativas autorizadas: **destinatários individuais**, grupos oficialmente elegíveis, ou outros canais corporativos. O painel deve permitir **configurar destinos por projeto**.

> **Estado:** a integração com a **WhatsApp Business Platform / Cloud API oficial (Meta)** está **implementada** no adaptador `WhatsAppChannelAdapter`, porém o canal permanece **DESATIVADO por padrão**: sem `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_CLOUD_API_TOKEN` no ambiente, o adaptador é **inerte** (nenhuma chamada de rede) e a entrega é registrada como **DESCARTADO**. A especificação prevê que a notificação "pode permanecer desativada até haver credenciais oficiais" (critério de aceite nº 10). Como ainda **não há credenciais oficiais**, **nenhuma mensagem é enviada** nesta versão.

---

## 8. Diagrama de filas e workers

```mermaid
flowchart LR
    API["API NestJS"] -->|"enfileira evento occurrence.created/updated"| Q["Fila BullMQ (Redis)"]
    Q --> W["Worker de Notificacao"]
    W --> DB[("PostgreSQL:<br/>NotificationRule / Delivery")]
    W --> CH{"Canal habilitado?"}
    CH -- "WhatsApp (desativado por padrao)" --> WA["WhatsApp Cloud API (Meta)<br/>inerte sem credenciais"]
    CH -- "E-mail / Teams (futuro)" --> ALT["Adaptadores futuros"]
    WA -- "falha" --> RETRY["Retentativa com backoff"]
    RETRY --> Q
    RETRY -- "esgotado" --> DLQ["Dead-Letter Queue"]
    DLQ --> ADMIN["Reprocessamento administrativo"]
    W -->|sucesso| DEL["Registra NotificationDelivery"]
```

---

## 9. Diagrama de sequência — notificação

```mermaid
sequenceDiagram
    autonumber
    participant API as API NestJS
    participant DB as PostgreSQL
    participant Q as Fila BullMQ
    participant W as Worker
    participant CH as Canal (adaptador)
    participant WA as WhatsApp Cloud API (desativado por padrao)

    Note over API: Ocorrencia JA salva com sucesso
    API->>Q: Enfileira evento (occurrenceId, eventType)
    API-->>API: Retorna 201 ao cliente (nao espera notificacao)
    Q->>W: Consome evento
    W->>DB: Consulta projeto, NotificationRule e destinos
    DB-->>W: Regras e destinos
    alt Canal WhatsApp desabilitado
        W->>DB: Registra delivery como "descartado/desabilitado" (sem envio)
    else Canal habilitado
        W->>W: Verifica idempotencia por evento/destino
        W->>CH: Prepara e envia mensagem padronizada
        CH->>WA: Envia (quando credenciais existirem)
        alt Sucesso
            WA-->>CH: providerMessageId
            CH-->>W: Resultado OK
            W->>DB: Registra NotificationDelivery (ENVIADO)
        else Falha
            WA-->>CH: erro
            CH-->>W: Resultado FALHA
            W->>DB: Registra tentativa + lastError (sem tokens)
            W->>Q: Reagenda com backoff (ou DLQ ao esgotar)
        end
    end
```

---

## 10. Idempotência e evitamento de duplicidade

- Cada tentativa é amarrada a uma **`idempotencyKey` por evento/destino** (`NotificationDelivery.idempotencyKey`).
- Reenvios com a mesma chave **não geram entrega duplicada**.
- Retentativa **não duplica notificação** (ver cenário obrigatório na [plano-de-testes.md](plano-de-testes.md)).

---

## 11. Pontos pendentes de definição

- Credenciais oficiais da WhatsApp Business Platform / Cloud API (Meta) — **PENDENTE DE DEFINIÇÃO** (a integração está implementada; faltam `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_CLOUD_API_TOKEN`).
- Elegibilidade da conta e suporte a grupos — **PENDENTE DE DEFINIÇÃO** (verificar doc oficial na implementação).
- Templates aprovados e política de janela de atendimento — **PENDENTE DE DEFINIÇÃO** (o envio por template **ou** texto livre já é suportado quando configurado).
- Destinos autorizados por projeto — **PENDENTE DE DEFINIÇÃO**.
- Provedor de e-mail/Teams (futuro) — **PENDENTE DE DEFINIÇÃO**.

---

## 12. Estado da implementação (Etapa 8)

Implementado conforme as seções 3 a 10 acima, com o **canal WhatsApp desativado**.

**API (`apps/api`)**
- `NotificationsModule`: destinos, regras e histórico por projeto (`/projects/:projectId/notifications/...`); configuração restrita a **GESTOR** do projeto (ou ADMINISTRADOR), consulta liberada a membro ativo.
- Reprocessamento administrativo: `POST /notifications/deliveries/:deliveryId/reprocess` (**ADMINISTRADOR**), reenfileirando com nova chave de idempotência.
- Publicação assíncrona e **não bloqueante**: o núcleo (`OccurrencesService`) publica via token `NOTIFICATION_PUBLISHER` (BullMQ quando `NOTIFICATIONS_ENABLED` ≠ `false`; no-op caso contrário). Falha de infraestrutura não desfaz o registro.

**Worker (`apps/worker`)**
- Processador BullMQ (fila `notifications`, `attempts: 3`, backoff exponencial) com DLQ `notifications-dlq`.
- Registro de cada tentativa em `NotificationDelivery` com **idempotência por evento/destino** (retentativa não duplica).
- Registro de canais (`createChannelRegistry`): `WhatsAppChannelAdapter` envia pela **Cloud API oficial** quando há credenciais (`WHATSAPP_*`) e é **inerte** (`discarded`, sem rede) quando não há; `EMAIL`/`TEAMS` reservados para evolução futura (`discarded`).
- Configuração lida por `readWhatsAppConfig()` (`WHATSAPP_API_VERSION` padrão `v21.0`; `WHATSAPP_TEMPLATE_LANGUAGE` padrão `pt_BR`; `WHATSAPP_TEMPLATE_NAME` opcional). Classificação do resultado: `200` → `ENVIADO`; `429`/`5xx` → `FALHA` (retentativa); demais `4xx` → `DESCARTADO` (nova tentativa não resolveria).
- Mensagem padronizada conforme a seção 4; `destinationConfig` nunca guarda segredos (lista permitida validada em `@qualitytest/shared`).

**Testes**
- Unitários do worker: 9 casos do processador (sucesso, descarte por canal desativado, idempotência, falha + retentativa, resolução por regra, filtro de prioridade, payload/ocorrência inválidos, destino desabilitado) + 8 casos dos canais (`channels.spec.ts`: inerte sem credenciais e sem rede, texto livre, template, `4xx`→descartado, `429`/`5xx`→falha, falha de rede→falha, destino inválido→descartado).
- E2E da API: 19 casos (autorização, validação de config sem segredos, isolamento por projeto, regras, histórico paginado, reprocessamento).

---

## 13. Referências

- Especificação mestra, seções 1, 7, 11, 16.
- [contratos-api.md](contratos-api.md)
- [modelo-de-dados.md](modelo-de-dados.md)
- [riscos-e-dependencias.md](riscos-e-dependencias.md)
