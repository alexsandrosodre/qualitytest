import { API_BASE_URL, REFRESH_THRESHOLD_MS } from './config';
import { writeSession } from './session';
import type {
  AttachmentUpload,
  AuthResponse,
  CreateOccurrencePayload,
  MeResponse,
  OccurrenceSummary,
  Session,
  SuggestionResult,
} from './types';

/** Envelope de erro padrão da API. */
interface ApiErrorBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
  timestamp?: string;
  path?: string;
}

/** Erro tipado da API, com status HTTP e mensagens do envelope de erro. */
export class ApiError extends Error {
  readonly status: number;

  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages.join(' '));
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
  }
}

/** Opções aceitas por `request`. */
interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}

/**
 * Cliente fetch tipado. Monta a URL base, anexa o Bearer token quando houver,
 * serializa o corpo em JSON e converte respostas de erro em `ApiError`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers, idempotencyKey } = options;

  const finalHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }
  if (idempotencyKey) {
    finalHeaders['Idempotency-Key'] = idempotencyKey;
  }

  let serializedBody: string | undefined;
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    serializedBody = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: serializedBody,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Autentica e emite tokens. */
export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

/** Renova o access token a partir do refresh token. */
export function refreshSession(refreshToken: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

/** Revoga o refresh token informado. */
export function logout(refreshToken: string): Promise<{ success: true }> {
  return request<{ success: true }>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
  });
}

/** Usuário autenticado e seus vínculos por projeto. */
export function fetchMe(accessToken: string): Promise<MeResponse> {
  return request<MeResponse>('/auth/me', { token: accessToken });
}

/** Sugere projeto(s) para a URL informada (sugestão sempre confirmável). */
export function suggestProject(accessToken: string, url: string): Promise<SuggestionResult> {
  return request<SuggestionResult>(`/projects/suggest?url=${encodeURIComponent(url)}`, {
    token: accessToken,
  });
}

/** Cria uma ocorrência (o autor é atribuído pelo servidor). */
export function createOccurrence(
  accessToken: string,
  payload: CreateOccurrencePayload,
  idempotencyKey: string,
): Promise<OccurrenceSummary> {
  return request<OccurrenceSummary>('/occurrences', {
    method: 'POST',
    token: accessToken,
    idempotencyKey,
    body: payload,
  });
}

/** Registra o anexo e obtém a URL assinada de upload. */
export function createAttachment(
  accessToken: string,
  occurrenceId: string,
  file: { fileName: string; mimeType: string; size: number },
): Promise<AttachmentUpload> {
  return request<AttachmentUpload>(`/occurrences/${occurrenceId}/attachments`, {
    method: 'POST',
    token: accessToken,
    body: file,
  });
}

/**
 * Envia o binário para a URL assinada. Só executa o PUT quando o esquema for
 * http/https. No ambiente de desenvolvimento sem S3 a URL vem como `memory://`
 * e não é acessível por fetch: nesse caso retorna `{ uploaded: false }` sem
 * tentar o PUT.
 */
export async function uploadToSignedUrl(
  uploadUrl: string,
  blob: Blob,
  mimeType: string,
): Promise<{ uploaded: boolean }> {
  const scheme = new URL(uploadUrl).protocol;
  if (scheme !== 'http:' && scheme !== 'https:') {
    return { uploaded: false };
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });

  if (!response.ok) {
    throw new ApiError(response.status, [
      `Falha ao enviar o binário do anexo (HTTP ${response.status}).`,
    ]);
  }

  return { uploaded: true };
}

/** Converte um data URL (base64) em `Blob` para upload. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header?.match(/data:([^;]+);base64/);
  const mimeType = mimeMatch?.[1] ?? 'application/octet-stream';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

/** Sessão acompanhada do resultado da operação autenticada. */
export interface SignedResult<T> {
  session: Session;
  result: T;
}

/**
 * Garante um access token válido, renovando via `/auth/refresh` quando o token
 * está próximo de expirar. Persiste a nova sessão. Renova no máximo UMA vez.
 */
export async function ensureAccessToken(session: Session): Promise<Session> {
  if (session.expiresAt - Date.now() > REFRESH_THRESHOLD_MS) {
    return session;
  }
  return forceRefresh(session);
}

/**
 * Executa uma operação autenticada: renova o token antecipadamente se
 * necessário e, em caso de 401, renova UMA vez e repete a operação. Se a
 * renovação falhar, propaga o `ApiError` (sessão inválida — novo login).
 */
export async function withValidSession<T>(
  session: Session,
  operation: (accessToken: string) => Promise<T>,
): Promise<SignedResult<T>> {
  const ensured = await ensureAccessToken(session);
  try {
    const result = await operation(ensured.accessToken);
    return { session: ensured, result };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const renewed = await forceRefresh(ensured);
      const result = await operation(renewed.accessToken);
      return { session: renewed, result };
    }
    throw error;
  }
}

async function forceRefresh(session: Session): Promise<Session> {
  const refreshed = await refreshSession(session.refreshToken);
  const next: Session = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    user: refreshed.user,
    projects: session.projects,
    expiresAt: Date.now() + refreshed.expiresIn * 1000,
  };
  await writeSession(next);
  return next;
}

async function toApiError(response: Response): Promise<ApiError> {
  let messages: string[] = [`Falha na requisição (HTTP ${response.status}).`];
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (Array.isArray(body.message)) {
      messages = body.message;
    } else if (typeof body.message === 'string' && body.message.length > 0) {
      messages = [body.message];
    }
  } catch {
    // Corpo não-JSON: mantém a mensagem genérica.
  }
  return new ApiError(response.status, messages);
}
