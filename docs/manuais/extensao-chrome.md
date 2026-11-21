# Manual da Extensão do Chrome

**Versão:** 1.0
**Data:** 21/11/2026
**Status:** Implementado

---

## 1. Objetivo

Orientar a instalação e o uso da **extensão do Google Chrome** do QUALITY TEST, que permite ao
testador registrar uma ocorrência enquanto navega no sistema em teste, com captura de screenshot,
sem alternar para o painel principal.

Código-fonte em `apps/extension` (Chrome Extension **Manifest V3**, TypeScript + React). A extensão
consome a **mesma API REST** do painel. Estratégia completa em
[../architecture/extensao-chrome.md](../architecture/extensao-chrome.md).

> A build é gerada em `apps/extension/dist` (`manifest.json`, `popup.html`, `popup.js`,
> `background.js`, `styles.css`).

---

## 2. Requisitos

- Node.js **>= 20** e npm instalados (para gerar a build).
- Google Chrome (ou derivado compatível com Manifest V3).
- A API do QUALITY TEST em execução (por padrão `http://localhost:3333/api`).

---

## 3. Build e instalação

### 3.1 Gerar a build

Na raiz do repositório:

```powershell
npm install
npm run build --workspace @qualitytest/extension
```

O script `build` da extensão executa `node build.mjs` e produz os arquivos em
`apps/extension/dist`. (`npm run build` na raiz também compila a extensão, junto com os demais
workspaces.)

### 3.2 Carregar no navegador

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** (*Load unpacked*).
4. Selecione a pasta `apps/extension/dist`.
5. A extensão “QUALITY TEST” aparecerá na barra de ferramentas.

### 3.3 Permissões da extensão

Definidas em `apps/extension/src/manifest.json` (e refletidas no `dist`):

- `permissions`: `activeTab`, `storage`.
- `host_permissions`: `http://localhost:3333/*` (apenas o backend de desenvolvimento).

---

## 4. Login

1. Clique no ícone **QUALITY TEST** na barra do Chrome para abrir o **popup**.
2. Se não houver sessão, o popup apresenta o formulário de **login** (E-mail e Senha).
3. Clique em **Entrar**.

A sessão (access + refresh token) é gravada em `chrome.storage.session` (área em **memória,
volátil**, limpa ao fechar o navegador), isolada da página em teste.
A extensão **renova o access token automaticamente** (via `/auth/refresh`) quando está próximo de
expirar e, em caso de `401`, renova e repete a operação uma vez. Se a sessão não puder ser
renovada, é solicitado novo login. Use **Sair** no cabeçalho do popup para encerrar a sessão.

---

## 5. Seleção de projeto e sugestão por domínio

Ao abrir o popup com sessão válida, a extensão:

1. Lê a **aba ativa** (URL e título).
2. Consulta `GET /api/projects/suggest?url=<url>` para **sugerir o projeto** por domínio.
3. Exibe a sugestão e o campo **Projeto** (lista apenas os projetos em que você tem vínculo ativo).

Regras de sugestão (a sugestão **nunca** é aplicada silenciosamente):

- **Uma única correspondência válida:** o projeto é **pré-selecionado** com o aviso
  `Sugestão: <nome>`; você pode trocar manualmente.
- **Ambiguidade** (múltiplos projetos correspondentes): exibe o aviso
  `Múltiplos projetos correspondem — selecione manualmente.` e **exige seleção manual**.

O `projectId` é tratado como **intenção** e sempre validado no servidor. A associação de
domínio→projeto é configurada no detalhe do projeto, aba **Domínios** (ver
[administrador.md](administrador.md)).

---

## 6. Captura de screenshot

1. Clique em **Capturar aba**. A extensão usa `chrome.tabs.captureVisibleTab` para capturar a aba
   ativa como PNG.
2. A **prévia** da imagem é exibida no popup.
3. Um aviso de privacidade orienta a **revisar a imagem antes de enviar**, pois ela pode conter
   dados sensíveis.

A permissão `activeTab` é concedida quando você invoca a extensão. Dados técnicos coletados são
apenas os permitidos (URL, título da página, navegador/SO e dimensões da captura). **Não** são
lidos senhas, cookies, tokens, conteúdo de formulários nem dados pessoais.

---

## 7. Envio para a API

1. Preencha **Título** (obrigatório, até 200 caracteres), **Descrição** (opcional), **Categoria** e
   **Prioridade**.
2. Clique em **Enviar ocorrência**.
3. A extensão chama `POST /api/occurrences` com o header **`Idempotency-Key`**
   (`crypto.randomUUID()`), anexando os dados técnicos da aba.
4. Se houver screenshot, em seguida solicita o upload (`POST .../attachments`) e faz o `PUT` na URL
   assinada.
5. Em caso de sucesso, o popup exibe o **código público** da ocorrência.

> O autor é atribuído pelo servidor a partir da sessão. Observe que, no ambiente de
> desenvolvimento **sem storage S3**, a URL assinada pode vir como `memory://`: nesse caso o anexo
> é registrado, mas o binário não é enviado (a extensão informa essa situação).

---

## 8. Fila local (offline) e reenvio

- Se o envio falhar por **falta de conexão** (erro de rede), a ocorrência é salva em uma **fila
  local** (`outbox` em `chrome.storage.local`) com estado **PENDENTE** e a **mesma
  `Idempotency-Key`**, evitando duplicidade no reenvio.
- Os jobs expiram após **24 horas**.
- O rodapé mostra a contagem de **ocorrências pendentes** e o botão **Reenviar pendentes** dispara
  o reenvio manualmente. O reenvio também é disparado ao abrir o popup.
- A fila é reenviada reutilizando o token da sessão; se a sessão expirar durante o reenvio, é
  solicitado novo login.
- A extensão **não** usa `chrome.alarms` — o reenvio é acionado ao abrir o popup (permissões
  mínimas).

---

## 9. Segurança e privacidade

- A sessão é armazenada em `chrome.storage.session` (área de **memória**, isolada da página em
  teste e limpa ao fechar o navegador, diferente de `localStorage`). A **outbox** de reenvio
  offline permanece em `chrome.storage.local` (não contém tokens).
- A comunicação é via HTTPS em produção (em desenvolvimento aponta para `http://localhost`).
- Somente dados técnicos permitidos são coletados; a imagem deve ser revisada antes do envio.
- Os tokens **não são persistidos em disco**: ficam apenas na memória do navegador durante a
  sessão, reduzindo a exposição em caso de comprometimento do perfil.

---

## 10. Configuração

- `apps/extension/src/lib/config.ts` define `API_BASE_URL = 'http://localhost:3333/api'`.
- **PENDENTE:** o **domínio oficial de produção** da API/extensão e, por consequência, os
  `permissions`/`host_permissions` definitivos do Manifest V3 — dependem da definição do domínio.

---

## 11. Pendências conhecidas

- Domínio oficial da API/extensão — **PENDENTE DE DEFINIÇÃO**.
- Lista exata de `permissions`/`host_permissions` — derivada do domínio — **PENDENTE**.
- Mecanismo de armazenamento seguro do token — **PENDENTE**.
- Canal de distribuição (Chrome Web Store interna vs. carregamento local) — **PENDENTE**.
- Recorte/ocultação de região da captura antes do envio — previsto na estratégia, **não
  implementado** (hoje há apenas captura da aba inteira e revisão visual).
- E2E de navegador — **não implementado**.

---

## 12. Referências

- [../../README.md](../../README.md)
- [../architecture/extensao-chrome.md](../architecture/extensao-chrome.md)
- [testador.md](testador.md)
