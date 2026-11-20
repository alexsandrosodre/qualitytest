#!/usr/bin/env node
/**
 * Aguarda os serviços de desenvolvimento (PostgreSQL/Redis) ficarem acessíveis.
 * Uso: node scripts/wait-for-services.mjs [host:porta ...]
 */
import net from 'node:net';

const DEFAULT_TARGETS = [
  { label: 'PostgreSQL', host: process.env.POSTGRES_HOST ?? 'localhost', port: Number(process.env.POSTGRES_PORT ?? 5432) },
  { label: 'Redis', host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) },
];

const TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS ?? 60_000);
const RETRY_MS = 1_000;

function tryConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2_000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function waitFor(target) {
  const startedAt = Date.now();
  for (;;) {
    const ok = await tryConnect(target.host, target.port);
    if (ok) {
      console.log(`[wait] ${target.label} disponível em ${target.host}:${target.port}`);
      return true;
    }
    if (Date.now() - startedAt > TIMEOUT_MS) {
      console.error(`[wait] tempo esgotado aguardando ${target.label} (${target.host}:${target.port})`);
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
}

const results = await Promise.all(DEFAULT_TARGETS.map((target) => waitFor(target)));
if (results.some((ok) => !ok)) {
  process.exit(1);
}
console.log('[wait] todos os serviços estão prontos.');
