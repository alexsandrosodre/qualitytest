import { RegistrationStatus } from '@qualitytest/shared';

import { SESSION_STORAGE_KEY } from './config';
import { clearSession, readSession, writeSession } from './session';
import type { Session } from './types';

interface FakeStorageArea {
  data: Map<string, unknown>;
  get: jest.Mock;
  set: jest.Mock;
  remove: jest.Mock;
}

/** Área de armazenamento em memória que imita a API `chrome.storage`. */
function createStorageArea(): FakeStorageArea {
  const data = new Map<string, unknown>();
  return {
    data,
    get: jest.fn(async (key: string) => (data.has(key) ? { [key]: data.get(key) } : {})),
    set: jest.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
    }),
    remove: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
}

interface ChromeMock {
  storage: { session: FakeStorageArea; local: FakeStorageArea };
}

let sessionArea: FakeStorageArea;
let localArea: FakeStorageArea;

beforeEach(() => {
  sessionArea = createStorageArea();
  localArea = createStorageArea();
  (globalThis as unknown as { chrome: ChromeMock }).chrome = {
    storage: { session: sessionArea, local: localArea },
  };
});

function buildSession(): Session {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      id: 'user-1',
      name: 'Ana Teste',
      email: 'ana@test.local',
      globalRole: null,
      status: RegistrationStatus.ATIVO,
    },
    projects: [],
    expiresAt: 1_700_000_000_000,
  };
}

describe('persistência da sessão em chrome.storage.session', () => {
  it('grava a sessão no storage de sessão (memória)', async () => {
    const session = buildSession();

    await writeSession(session);

    expect(sessionArea.set).toHaveBeenCalledWith({ [SESSION_STORAGE_KEY]: session });
  });

  it('NÃO grava tokens no storage local (disco)', async () => {
    await writeSession(buildSession());

    expect(localArea.set).not.toHaveBeenCalled();
  });

  it('lê a sessão previamente gravada', async () => {
    const session = buildSession();
    await writeSession(session);

    await expect(readSession()).resolves.toEqual(session);
  });

  it('retorna null quando não há sessão', async () => {
    await expect(readSession()).resolves.toBeNull();
  });

  it('retorna null para um valor inválido (formato inesperado)', async () => {
    await sessionArea.set({ [SESSION_STORAGE_KEY]: { accessToken: 123 } });

    await expect(readSession()).resolves.toBeNull();
  });

  it('remove a sessão no logout', async () => {
    await writeSession(buildSession());

    await clearSession();

    expect(sessionArea.remove).toHaveBeenCalledWith(SESSION_STORAGE_KEY);
    await expect(readSession()).resolves.toBeNull();
  });
});
