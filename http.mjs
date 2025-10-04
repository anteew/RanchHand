import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { embeddings, chatCompletion } from './src/oai_client.mjs';
import { store } from './src/store_memory.mjs';
import { getProfiles, mergeProfiles } from './src/profiles.mjs';

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
    if (req.method === 'GET' && url.pathname === '/profiles') {
      return send(res, 200, { ok: true, profiles: getProfiles() });
    }
    if (req.method === 'POST' && url.pathname === '/profiles') {
      const body = await parseJson(req);
      const merged = mergeProfiles(body || {});
      return send(res, 200, { ok: true, profiles: merged });
    }
    // Auth check
    const token = req.headers['x-ranchhand-token'];
    if (token !== SECRET) return unauthorized(res);

    if (req.method === 'POST' && url.pathname === '/ingest/slack') {
      const body = await parseJson(req);
      const namespace = String(body?.namespace || '').trim();
      const items = Array.isArray(body?.items) ? body.items : [];
      if (!namespace || !items.length) return send(res, 400, { ok: false, error: 'bad-request' });
      const jobId = crypto.randomUUID();
      // Chunk: naive split by ~512 words without overlap; future: token-aware
      const chunks = [];
      const CHUNK_WORDS = Math.max(64, Math.min(4096, parseInt(process.env.RH_CHUNK_WORDS || '512', 10)));
      for (const it of items) {
        const words = String(it.text || '').split(/\s+/);
        for (let i = 0; i < words.length; i += CHUNK_WORDS) {
          const part = words.slice(i, i + CHUNK_WORDS).join(' ');
          if (!part.trim()) continue;
          chunks.push({ ns: namespace, id: `${it.ts || ''}:${i/CHUNK_WORDS|0}`, text: part, metadata: { source: 'slack', ts: it.ts || null, userName: it.userName || null } });
        }
      }
      // Embed (batch)
      const inputs = chunks.map(c => c.text);
      const prof = getProfiles();
      const embedModel = prof?.embed?.model || undefined;
      let embs;
      try {
        const out = await embeddings({ model: embedModel, input: inputs });
        embs = out?.data?.map(d => d.embedding) || [];
      } catch (e) {
        return send(res, 500, { ok: false, error: 'embed-failed', detail: String(e) });
      }
      // Upsert
      const upserts = [];
      for (let i = 0; i < chunks.length; i++) {
        upserts.push({ id: `${chunks[i].id}`, vector: embs[i] || [], text: chunks[i].text, metadata: chunks[i].metadata });
      }
      const u = store.upsertMany(namespace, upserts);
      const counts = { items: items.length, chunks: chunks.length, embeddings: u.count };
      return send(res, 200, { ok: true, jobId, namespace, counts, sample: smallSample(items) });
    }

    if (req.method === 'POST' && url.pathname === '/query') {
      const body = await parseJson(req);
      const ns = String(body?.namespace || '').trim();
      const query = String(body?.query || '');
      const topK = Math.max(1, Math.min(50, parseInt(body?.topK || '5', 10)));
      const withText = body?.withText !== false;
      if (!ns || !query) return send(res, 400, { ok: false, error: 'bad-request' });
      let qvec;
      try {
        const out = await embeddings({ input: query });
        qvec = out?.data?.[0]?.embedding || [];
      } catch (e) {
        return send(res, 500, { ok: false, error: 'embed-failed', detail: String(e) });
      }
      const results = store.query(ns, qvec, topK, withText);
      return send(res, 200, { ok: true, results });
    }

    if (req.method === 'POST' && url.pathname === '/answer') {
      const body = await parseJson(req);
      const ns = String(body?.namespace || '').trim();
      const query = String(body?.query || '');
      const topK = Math.max(1, Math.min(10, parseInt(body?.topK || '5', 10)));
      if (!ns || !query) return send(res, 400, { ok: false, error: 'bad-request' });
      // Embed query
      let qvec;
      try {
        const out = await embeddings({ input: query });
        qvec = out?.data?.[0]?.embedding || [];
      } catch (e) {
        return send(res, 500, { ok: false, error: 'embed-failed', detail: String(e) });
      }
      // Retrieve context
      const results = store.query(ns, qvec, topK, true);
      const context = results.map((r, i) => `Source [${i+1}]:\n${String(r.text||'').slice(0, 800)}`).join('\n\n');
      const prof = getProfiles();
      const model = body?.model || prof?.summarize_retrieval?.model;
      const temperature = (typeof body?.temperature === 'number') ? body.temperature : (prof?.summarize_retrieval?.temperature ?? 0.1);
      const max_tokens = (typeof body?.max_tokens === 'number') ? body.max_tokens : (prof?.summarize_retrieval?.max_tokens ?? 256);
      const system = 'You are a helpful assistant. Answer concisely using only the provided sources. Cite sources with bracketed numbers like [1], [2]. If unsure, say you do not have enough information.';
      const user = `Question:\n${query}\n\nContext:\n${context}`;
      try {
        const out = await chatCompletion({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature, max_tokens });
        const answer = out.text || '';
        const citations = results.map((r, i) => ({ index: i+1, id: r.id, score: r.score, snippet: String(r.text||'').slice(0, 240), metadata: r.metadata }));
        return send(res, 200, { ok: true, answer, citations, used: { topK, model, temperature, max_tokens } });
      } catch (e) {
        return send(res, 500, { ok: false, error: 'generate-failed', detail: String(e) });
      }
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
