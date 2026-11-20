/**
 * Cliente HTTP tipado do frontend.
 *
 * - Lê a base URL de `NEXT_PUBLIC_API_URL` (fallback local).
 * - Anexa o header `Authorization: Bearer <accessToken>` quando disponível.
 * - Em `401` tenta `POST /auth/refresh` UMA única vez e repete a chamada.
 * - Normaliza erros em `ApiRequestError` (status + lista de mensagens).
 */
import type { ApiError } from '@qualitytest/shared';

import type { LoginResult } from './types';

export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly messages: string[];
  readonly error: string;

  constructor(status: number, messages: string[], error: string) {
    super(messages.join(' '));
    this.name = 'ApiRequestError';
    this.status = status;
    this.messages = messages;
    this.error = error;
  }
}

interface TokenSnapshot {
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthBridge {
  getTokens: () => TokenSnapshot;
  onTokensRefreshed: (tokens: TokenSnapshot) => void;
  onAuthLost: () => void;
}

let bridge: AuthBridge | null = null;
let refreshInFlight: Promise<boolean> | null = null;

/** Registra a ponte com o `AuthProvider` (chamado uma vez na montagem). */
export function configureApiClient(next: AuthBridge): void {
  bridge = next;
}

function tokens(): TokenSnapshot {
  return bridge?.getTokens() ?? { accessToken: null, refreshToken: null };
}

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  body?: unknown;
  /** Header `Idempotency-Key` (obrigatório em `POST /occurrences`). */
  idempotencyKey?: string;
  /** `false` para rotas públicas (login, refresh, forgot/reset). */
  authenticated?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);

  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function toApiError(response: Response): Promise<ApiRequestError> {
  let error = response.statusText;
  const messages: string[] = [];

  try {
    const payload = (await response.json()) as Partial<ApiError>;
    if (typeof payload.error === 'string' && payload.error.length > 0) {
      error = payload.error;
    }
    if (typeof payload.message === 'string') {
      messages.push(payload.message);
    } else if (Array.isArray(payload.message)) {
      messages.push(...payload.message.filter((entry) => typeof entry === 'string'));
    }
  } catch {
    // Corpo não-JSON: mantém os valores padrão.
  }

  if (messages.length === 0) {
    messages.push(error.length > 0 ? error : 'Erro inesperado na requisição.');
  }

  return new ApiRequestError(response.status, messages, error);
}

/** Traduz mensagens de erro da API para texto amigável em português. */
export function describeApiError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    switch (error.status) {
      case 401:
        return 'Sessão expirada. Faça login novamente.';
      case 403:
        return 'Você não tem permissão para esta ação.';
      case 404:
        return error.messages[0] ?? 'Registro não encontrado.';
      case 409:
        return error.messages[0] ?? 'Já existe um registro com estes dados.';
      case 422:
        return error.messages[0] ?? 'Dados inválidos.';
      default:
        return error.messages.join(' ');
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Erro inesperado.';
}

async function attemptRefresh(): Promise<boolean> {
  if (refreshInFlight !== null) {
    return refreshInFlight;
  }

  const current = tokens();
  if (current.refreshToken === null || current.refreshToken === '') {
    return false;
  }

  refreshInFlight = (async (): Promise<boolean> => {
    try {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as LoginResult;
      bridge?.onTokensRefreshed({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function send(
  method: string,
  path: string,
  options: RequestOptions,
  isRetry: boolean,
): Promise<Response> {
  const authenticated = options.authenticated ?? true;
  const headers: Record<string, string> = { ...options.headers };

  if (authenticated) {
    const snapshot = tokens();
    if (snapshot.accessToken !== null && snapshot.accessToken !== '') {
      headers.Authorization = `Bearer ${snapshot.accessToken}`;
    }
  }

  if (options.idempotencyKey !== undefined) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    body,
    signal: options.signal,
  });

  if (response.status === 401 && authenticated && !isRetry) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return send(method, path, options, true);
    }
    bridge?.onAuthLost();
  }

  return response;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions,
): Promise<T> {
  const response = await send(method, path, options, false);

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (text.length === 0) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>('GET', path, options);
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>('POST', path, { ...options, body });
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>('PATCH', path, { ...options, body });
}

export function apiDelete<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>('DELETE', path, options);
}
