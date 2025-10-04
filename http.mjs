import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const HOST = process.env.RANCHHAND_HOST || '127.0.0.1';
const PORT = parseInt(process.env.RANCHHAND_PORT || '41414', 10);
const TWI_DIR = path.join(os.homedir(), '.threadweaverinc');
const AUTH_DIR = path.join(TWI_DIR, 'auth');
const SECRET_FILE = process.env.TWI_SECRET_FILE || path.join(AUTH_DIR, 'shared_secret.txt');

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch (_) {} }

function ensureSecret() {
  ensureDir(AUTH_DIR);
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const s = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (s) return s;
    }
  } catch (_) {}
  const rand = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(SECRET_FILE, rand, { mode: 0o600 });
  } catch (_) {}
  return rand;
}

const SECRET = ensureSecret();

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 10 * 1024 * 1024) { req.destroy(); reject(new Error('payload-too-large')); } });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function unauthorized(res) { send(res, 401, { ok: false, error: 'unauthorized' }); }

function smallSample(items, n = 3) {
  const out = [];
  for (const it of items.slice(0, n)) {
    out.push({ ts: it.ts, userName: it.userName || it.userId || null, textSnippet: String(it.text || '').slice(0, 160) });
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (url.pathname === '/health') {
      return send(res, 200, { ok: true, service: 'ranchhand', host: HOST, port: PORT });
    }
    // Auth check
    const token = req.headers['x-ranchhand-token'];
    if (token !== SECRET) return unauthorized(res);

    if (req.method === 'POST' && url.pathname === '/ingest/slack') {
      const body = await parseJson(req);
      const namespace = String(body?.namespace || '').trim() || null;
      const items = Array.isArray(body?.items) ? body.items : [];
      const counts = { items: items.length, chunks: 0, embeddings: 0 };
      // Placeholder: chunk + embed + upsert goes here. For now, we just acknowledge.
      const jobId = crypto.randomUUID();
      return send(res, 200, { ok: true, jobId, namespace, counts, sample: smallSample(items) });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/secret')) {
      // For debugging local setup only; avoid exposing secret.
      return send(res, 200, { ok: true, present: !!SECRET_FILE });
    }

    return send(res, 404, { ok: false, error: 'not-found' });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e?.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`RanchHand HTTP listening at http://${HOST}:${PORT}`);
});

