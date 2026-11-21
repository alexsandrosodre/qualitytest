import {
  ApiError,
  createAttachment,
  createOccurrence,
  dataUrlToBlob,
  uploadToSignedUrl,
  withValidSession,
} from './lib/api';
import { listPendingJobs, removeJob } from './lib/outbox';
import { readSession } from './lib/session';
import type { OutboxAttachment, Session } from './lib/types';

/**
 * Service worker da extensão (Manifest V3).
 *
 * IMPORTANTE: o service worker é efêmero e pode ser encerrado a qualquer
 * momento. Portanto NÃO armazenamos tokens em variáveis globais persistidas: a
 * sessão é sempre lida/gravada em `chrome.storage.session` (ver `lib/session.ts`).
 */

interface CaptureTabResponse {
  dataUrl?: string;
  error?: string;
}

interface FlushOutboxResponse {
  sent: number;
  remaining: number;
  error?: string;
}

type ExtensionResponse = CaptureTabResponse | FlushOutboxResponse;

function readMessageType(message: unknown): string | null {
  if (typeof message === 'object' && message !== null && 'type' in message) {
    const { type } = message as { type: unknown };
    return typeof type === 'string' ? type : null;
  }
  return null;
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void,
  ): boolean => {
    const type = readMessageType(message);

    if (type === 'CAPTURE_TAB') {
      void handleCaptureTab().then((response) => sendResponse(response));
      return true;
    }

    if (type === 'FLUSH_OUTBOX') {
      void handleFlushOutbox().then((response) => sendResponse(response));
      return true;
    }

    return false;
  },
);

/**
 * Captura a aba ativa como PNG e devolve o data URL. Requer a permissão
 * `activeTab` (concedida quando o usuário invoca a extensão).
 */
async function handleCaptureTab(): Promise<CaptureTabResponse> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || typeof tab.windowId !== 'number') {
      return { error: 'Não foi possível identificar a aba ativa.' };
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    return { dataUrl };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

/**
 * Reenvia os jobs pendentes da fila local. Cada job reutiliza sua própria
 * `Idempotency-Key`, evitando duplicidade. Sessão inválida mantém os jobs como
 * pendentes e interrompe o envio.
 */
async function handleFlushOutbox(): Promise<FlushOutboxResponse> {
  const storedSession = await readSession();
  if (!storedSession) {
    const jobs = await listPendingJobs();
    return { sent: 0, remaining: jobs.length, error: 'Sessão ausente. Faça login para reenviar.' };
  }

  const jobs = await listPendingJobs();
  let activeSession: Session = storedSession;
  let sent = 0;

  for (const job of jobs) {
    try {
      const { session, result } = await withValidSession(activeSession, (token) =>
        createOccurrence(token, job.payload, job.idempotencyKey),
      );
      activeSession = session;

      if (job.attachment) {
        try {
          await sendJobAttachment(activeSession, result.id, job.attachment);
        } catch {
          // Falha ao anexar não bloqueia a remoção: a ocorrência principal já existe.
        }
      }

      await removeJob(job.id);
      sent += 1;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const remaining = await listPendingJobs();
        return {
          sent,
          remaining: remaining.length,
          error: 'Sessão expirada. Faça login para reenviar.',
        };
      }
      // Erro de rede ou outro: mantém o job pendente para nova tentativa.
    }
  }

  const remaining = await listPendingJobs();
  return { sent, remaining: remaining.length };
}

async function sendJobAttachment(
  session: Session,
  occurrenceId: string,
  attachment: OutboxAttachment,
): Promise<void> {
  const blob = dataUrlToBlob(attachment.dataUrl);
  const upload = await createAttachment(session.accessToken, occurrenceId, {
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: blob.size,
  });
  await uploadToSignedUrl(upload.uploadUrl, blob, attachment.mimeType);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido.';
}

/**
 * Não usamos `chrome.alarms`: para manter as permissões mínimas (sem a permissão
 * "alarms"), o reenvio da fila local é disparado quando o popup é aberto.
 */
chrome.runtime.onInstalled.addListener(() => {
  // Nada a agendar por ora; ver comentário acima.
});
