import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';

import {
  OCCURRENCE_CATEGORIES,
  OCCURRENCE_PRIORITIES,
  OccurrenceCategory,
  OccurrencePriority,
} from '@qualitytest/shared';

import {
  ApiError,
  createAttachment,
  createOccurrence,
  dataUrlToBlob,
  fetchMe,
  login,
  logout,
  suggestProject,
  uploadToSignedUrl,
  withValidSession,
} from '../lib/api';
import { collectPageDiagnostics } from '../lib/diagnostics';
import { enqueueJob, listPendingJobs } from '../lib/outbox';
import { clearSession, readSession, writeSession } from '../lib/session';
import type { CreateOccurrencePayload, ProjectRef, Session, SuggestionResult } from '../lib/types';

/** Estágio de carregamento da sessão. */
type Status = 'carregando' | 'sem-sessao' | 'pronto';

/** Imagem capturada da aba, mantida em memória enquanto o popup está aberto. */
interface CapturedImage {
  dataUrl: string;
  width: number;
  height: number;
  byteSize: number;
}

/** Resultado da submissão bem-sucedida. */
interface SubmitResult {
  publicCode: string;
  attachmentNotice: string;
}

/** Rótulos em pt-BR das categorias. */
const CATEGORY_LABELS: Record<OccurrenceCategory, string> = {
  [OccurrenceCategory.ERRO_FUNCIONAL]: 'Erro funcional',
  [OccurrenceCategory.ERRO_VISUAL]: 'Erro visual',
  [OccurrenceCategory.ERRO_INTEGRACAO]: 'Erro de integração',
  [OccurrenceCategory.ERRO_VALIDACAO]: 'Erro de validação',
  [OccurrenceCategory.DESEMPENHO]: 'Desempenho',
  [OccurrenceCategory.SEGURANCA]: 'Segurança',
  [OccurrenceCategory.ACESSIBILIDADE]: 'Acessibilidade',
  [OccurrenceCategory.COMPATIBILIDADE]: 'Compatibilidade',
  [OccurrenceCategory.OUTROS]: 'Outros',
};

/** Rótulos em pt-BR das prioridades. */
const PRIORITY_LABELS: Record<OccurrencePriority, string> = {
  [OccurrencePriority.CRITICA]: 'Crítica',
  [OccurrencePriority.ALTA]: 'Alta',
  [OccurrencePriority.MEDIA]: 'Média',
  [OccurrencePriority.BAIXA]: 'Baixa',
};

/** Decisão tomada a partir da sugestão de projeto. */
interface SuggestionDecision {
  projectId: string | null;
  notice: string;
}

/**
 * Decisão da sugestão de projeto. A sugestão NUNCA é aplicada silenciosamente:
 * em caso de ambiguidade, exige seleção manual; com uma única sugestão válida,
 * pré-seleciona mas informa o usuário (que pode trocar).
 */
function decideSuggestion(result: SuggestionResult, projects: ProjectRef[]): SuggestionDecision {
  const belongs = result.suggestions.filter((item) =>
    projects.some((project) => project.projectId === item.projectId),
  );

  if (result.ambiguous || belongs.length > 1) {
    return { projectId: null, notice: 'Múltiplos projetos correspondem — selecione manualmente.' };
  }

  const only = belongs[0];
  if (only) {
    return { projectId: only.projectId, notice: `Sugestão: ${only.name}` };
  }

  return { projectId: null, notice: '' };
}

interface BuildPayloadInput {
  projectId: string;
  title: string;
  description: string;
  category: OccurrenceCategory;
  priority: OccurrencePriority;
  tab: chrome.tabs.Tab | null;
  imageWidth?: number;
  imageHeight?: number;
}

/** Monta o payload de criação de ocorrência com os dados técnicos permitidos. */
function buildPayload(input: BuildPayloadInput): CreateOccurrencePayload {
  const diagnostics = input.tab
    ? collectPageDiagnostics(input.tab, {
        imageWidth: input.imageWidth,
        imageHeight: input.imageHeight,
      })
    : undefined;

  return {
    projectId: input.projectId,
    title: input.title.trim(),
    description: input.description.trim() || undefined,
    categoryId: input.category,
    priority: input.priority,
    pageUrl: diagnostics?.pageUrl,
    pageTitle: diagnostics?.pageTitle,
    browserInfo: diagnostics?.browserInfo,
    operatingSystemInfo: diagnostics?.operatingSystemInfo,
    viewportInfo: diagnostics?.viewportInfo,
  };
}

/** Falhas de conexão surgem como `TypeError` do fetch. */
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = dataUrl;
  });
}

async function sendScreenshot(
  session: Session,
  occurrenceId: string,
  image: CapturedImage,
): Promise<string> {
  try {
    const blob = dataUrlToBlob(image.dataUrl);
    const upload = await createAttachment(session.accessToken, occurrenceId, {
      fileName: 'screenshot.png',
      mimeType: 'image/png',
      size: blob.size,
    });
    const { uploaded } = await uploadToSignedUrl(upload.uploadUrl, blob, 'image/png');
    return uploaded
      ? 'Imagem anexada com sucesso.'
      : 'Anexo registrado, binário não enviado (storage de desenvolvimento).';
  } catch {
    return 'Ocorrência registrada, mas houve falha ao anexar a imagem.';
  }
}

function isCaptureSuccess(value: unknown): value is { dataUrl: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dataUrl' in value &&
    typeof (value as { dataUrl: unknown }).dataUrl === 'string'
  );
}

function isCaptureFailure(value: unknown): value is { error: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'string'
  );
}

function isFlushResponse(value: unknown): value is { sent: number; remaining: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sent' in value &&
    'remaining' in value &&
    typeof (value as { sent: unknown }).sent === 'number' &&
    typeof (value as { remaining: unknown }).remaining === 'number'
  );
}

export function Popup(): ReactElement {
  const [status, setStatus] = useState<Status>('carregando');
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null);
  const [suggestionNotice, setSuggestionNotice] = useState('');

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<OccurrenceCategory>(OccurrenceCategory.ERRO_FUNCIONAL);
  const [priority, setPriority] = useState<OccurrencePriority>(OccurrencePriority.MEDIA);
  const [screenshot, setScreenshot] = useState<CapturedImage | null>(null);

  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState<SubmitResult | null>(null);
  const [pendingNotice, setPendingNotice] = useState('');

  const [pendingCount, setPendingCount] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const [flushMessage, setFlushMessage] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const refreshPending = useCallback(async (): Promise<void> => {
    const jobs = await listPendingJobs();
    setPendingCount(jobs.length);
  }, []);

  // Mantém a referência da sessão atualizada para leitura dentro de efeitos.
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Carrega a sessão persistida ao abrir o popup.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readSession();
      if (cancelled) {
        return;
      }
      if (stored) {
        setSession(stored);
        setStatus('pronto');
      } else {
        setStatus('sem-sessao');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Com sessão válida, lê a aba ativa, sugere projeto e conta pendentes.
  useEffect(() => {
    if (status !== 'pronto') {
      return;
    }
    let cancelled = false;
    void (async () => {
      const current = sessionRef.current;
      if (current) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (cancelled) {
            return;
          }
          const tab = tabs[0] ?? null;
          setActiveTab(tab);
          if (tab?.url) {
            const outcome = await withValidSession(current, (token) =>
              suggestProject(token, tab.url ?? ''),
            );
            if (cancelled) {
              return;
            }
            setSession(outcome.session);
            const decision = decideSuggestion(outcome.result, outcome.session.projects);
            setSuggestionNotice(decision.notice);
            if (decision.projectId) {
              setSelectedProjectId(decision.projectId);
            }
          }
        } catch {
          if (!cancelled) {
            setSuggestionNotice('');
          }
        }
      }
      if (!cancelled) {
        await refreshPending();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, refreshPending]);

  function resetRecordForm(): void {
    setTitle('');
    setDescription('');
    setScreenshot(null);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const auth = await login(loginEmail.trim(), loginPassword);
      const me = await fetchMe(auth.accessToken);
      const next: Session = {
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        user: me.user,
        projects: me.projects,
        expiresAt: Date.now() + auth.expiresIn * 1000,
      };
      await writeSession(next);
      setSession(next);
      setStatus('pronto');
      setLoginPassword('');
    } catch {
      setLoginError('Credenciais inválidas.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout(): Promise<void> {
    const current = sessionRef.current;
    if (current) {
      try {
        await logout(current.refreshToken);
      } catch {
        // Falha de rede no logout não impede a limpeza local da sessão.
      }
    }
    await clearSession();
    setSession(null);
    setStatus('sem-sessao');
    resetRecordForm();
    setFormSuccess(null);
    setFormError('');
    setSuggestionNotice('');
    setSelectedProjectId('');
    setPendingNotice('');
  }

  async function handleCapture(): Promise<void> {
    setFormError('');
    setCapturing(true);
    try {
      const raw: unknown = await chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' });
      if (isCaptureSuccess(raw)) {
        const size = await loadImageSize(raw.dataUrl);
        setScreenshot({
          dataUrl: raw.dataUrl,
          width: size.width,
          height: size.height,
          byteSize: dataUrlToBlob(raw.dataUrl).size,
        });
      } else if (isCaptureFailure(raw)) {
        setFormError(`Não foi possível capturar a aba: ${raw.error}`);
      } else {
        setFormError('Não foi possível capturar a aba.');
      }
    } catch {
      setFormError('Não foi possível capturar a aba.');
    } finally {
      setCapturing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const current = sessionRef.current;
    if (!current || !selectedProjectId || title.trim().length === 0 || submitting) {
      return;
    }

    setFormError('');
    setFormSuccess(null);
    setPendingNotice('');
    setSubmitting(true);

    const idempotencyKey = crypto.randomUUID();
    const payload = buildPayload({
      projectId: selectedProjectId,
      title,
      description,
      category,
      priority,
      tab: activeTab,
      imageWidth: screenshot?.width,
      imageHeight: screenshot?.height,
    });

    try {
      const { session: active, result } = await withValidSession(current, (token) =>
        createOccurrence(token, payload, idempotencyKey),
      );
      setSession(active);

      let attachmentNotice = '';
      if (screenshot) {
        attachmentNotice = await sendScreenshot(active, result.id, screenshot);
      }

      setFormSuccess({ publicCode: result.publicCode, attachmentNotice });
      resetRecordForm();
    } catch (error) {
      if (isNetworkError(error)) {
        await enqueueJob({
          payload,
          idempotencyKey,
          ...(screenshot
            ? {
                attachment: {
                  fileName: 'screenshot.png',
                  mimeType: 'image/png',
                  size: screenshot.byteSize,
                  dataUrl: screenshot.dataUrl,
                },
              }
            : {}),
        });
        await refreshPending();
        setPendingNotice(
          'Sem conexão: ocorrência salva localmente como PENDENTE e será reenviada.',
        );
      } else if (error instanceof ApiError && error.status === 401) {
        await clearSession();
        setSession(null);
        setStatus('sem-sessao');
        setLoginError('Sessão expirada. Faça login novamente.');
      } else if (error instanceof ApiError) {
        setFormError(error.messages.join(' ') || 'Não foi possível registrar a ocorrência.');
      } else {
        setFormError('Não foi possível registrar a ocorrência.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFlush(): Promise<void> {
    setFlushing(true);
    setFlushMessage('');
    try {
      const raw: unknown = await chrome.runtime.sendMessage({ type: 'FLUSH_OUTBOX' });
      if (isFlushResponse(raw)) {
        await refreshPending();
        setFlushMessage(`Reenvio concluído: ${raw.sent} enviada(s), ${raw.remaining} pendente(s).`);
      } else {
        setFlushMessage('Não foi possível reenviar as ocorrências pendentes.');
      }
    } catch {
      setFlushMessage('Não foi possível reenviar as ocorrências pendentes.');
    } finally {
      setFlushing(false);
    }
  }

  if (status === 'carregando') {
    return <p className="muted">Carregando...</p>;
  }

  if (status === 'sem-sessao') {
    return (
      <section className="login">
        <h1>QUALITY TEST</h1>
        <p className="muted">Entre com sua conta para registrar ocorrências.</p>
        <form onSubmit={handleLogin}>
          <label>
            Email
            <input
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {loginError ? <p className="mensagem erro">{loginError}</p> : null}
          <button type="submit" className="btn-primario" disabled={loginLoading}>
            {loginLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    );
  }

  if (!session) {
    return <p className="muted">Carregando...</p>;
  }

  const selectedProject =
    session.projects.find((project) => project.projectId === selectedProjectId) ?? null;
  const canSubmit = !submitting && selectedProjectId.length > 0 && title.trim().length > 0;

  return (
    <section className="registro">
      <div className="cabecalho">
        <div>
          <h1>QUALITY TEST</h1>
          <div className="usuario">{session.user.name}</div>
        </div>
        <button type="button" className="btn-secundario" onClick={handleLogout}>
          Sair
        </button>
      </div>

      <div>
        <div>
          <strong>Página:</strong> {activeTab?.title ?? 'Não disponível'}
        </div>
        <div className="muted">{activeTab?.url ?? 'Não disponível'}</div>
      </div>

      <form onSubmit={handleSubmit}>
        <label>
          Projeto
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            <option value="">Selecione um projeto</option>
            {session.projects.map((project) => (
              <option key={project.projectId} value={project.projectId}>
                {project.name} ({project.code})
              </option>
            ))}
          </select>
        </label>
        {suggestionNotice ? <p className="mensagem aviso">{suggestionNotice}</p> : null}

        <label>
          Título
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
          />
        </label>

        <label>
          Descrição (opcional)
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={4000}
          />
        </label>

        <div className="linha">
          <label>
            Categoria
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as OccurrenceCategory)}
            >
              {OCCURRENCE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Prioridade
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as OccurrencePriority)}
            >
              {OCCURRENCE_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" className="btn-secundario" onClick={handleCapture} disabled={capturing}>
          {capturing ? 'Capturando...' : 'Capturar aba'}
        </button>

        {screenshot ? (
          <>
            <p className="privacy">
              Revise a imagem antes de enviar; ela pode conter dados sensíveis.
            </p>
            <div className="preview">
              <img src={screenshot.dataUrl} alt="Prévia da captura da aba" />
            </div>
          </>
        ) : null}

        {formError ? <p className="mensagem erro">{formError}</p> : null}
        {pendingNotice ? <p className="mensagem aviso">{pendingNotice}</p> : null}
        {formSuccess ? (
          <div className="mensagem sucesso">
            <strong>Ocorrência {formSuccess.publicCode} registrada com sucesso.</strong>
            {selectedProject ? <div>Projeto: {selectedProject.name}</div> : null}
            <div>
              Categoria: {CATEGORY_LABELS[category]} · Prioridade: {PRIORITY_LABELS[priority]}
            </div>
            {formSuccess.attachmentNotice ? <div>{formSuccess.attachmentNotice}</div> : null}
          </div>
        ) : null}

        <button type="submit" className="btn-primario" disabled={!canSubmit}>
          {submitting ? 'Enviando...' : 'Enviar ocorrência'}
        </button>
      </form>

      {pendingCount > 0 ? (
        <div className="rodape">
          <span className="muted">{pendingCount} ocorrência(s) pendente(s)</span>
          <button type="button" className="btn-secundario" onClick={handleFlush} disabled={flushing}>
            {flushing ? 'Reenviando...' : 'Reenviar pendentes'}
          </button>
        </div>
      ) : null}

      {flushMessage ? <p className="mensagem aviso">{flushMessage}</p> : null}
    </section>
  );
}
