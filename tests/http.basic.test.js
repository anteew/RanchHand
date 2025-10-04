import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';

const TEST_HOST = '127.0.0.1';
const TEST_PORT = 41415;
let child;

async function waitForServer(url, timeoutMs = 5000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (_) {}
    if (Date.now() - start > timeoutMs) throw new Error('server not ready');
    await new Promise(r => setTimeout(r, 100));
  }
}

describe('RanchHand HTTP basic routes', () => {
  beforeAll(async () => {
    child = spawn(process.execPath, ['http.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        RANCHHAND_HOST: TEST_HOST,
        RANCHHAND_PORT: String(TEST_PORT),
        TWI_SECRET_FILE: `${process.cwd()}/.test-secret.txt`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForServer(`http://${TEST_HOST}:${TEST_PORT}/health`);
  }, 15000);

  afterAll(async () => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 200));
    }
  });

  it('GET /health returns ok', async () => {
    const res = await fetch(`http://${TEST_HOST}:${TEST_PORT}/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.service).toBe('ranchhand');
  });

  it('GET /profiles returns default profiles', async () => {
    const res = await fetch(`http://${TEST_HOST}:${TEST_PORT}/profiles`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.profiles).toBeTypeOf('object');
  });

  it('POST /profiles merges provided config', async () => {
    const body = { embed: { model: 'nomic-embed-text:latest' }, chunking: { chunk_tokens: 256 } };
    const res = await fetch(`http://${TEST_HOST}:${TEST_PORT}/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.profiles.embed.model).toBe('nomic-embed-text:latest');
    expect(json.profiles.chunking.chunk_tokens).toBe(256);
  });
});
