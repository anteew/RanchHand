// Simple in-memory vector store per namespace
// Not for production use; replace with Qdrant/Chroma adapter later

import crypto from 'node:crypto';

function hashId(s) { return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { const x = a[i], y = b[i]; dot += x * y; na += x * x; nb += y * y; }
  const denom = Math.sqrt(na) * Math.sqrt(nb); return denom ? (dot / denom) : 0;
}

class MemoryStore {
  constructor() { this.namespaces = new Map(); }

  _ns(ns) { if (!this.namespaces.has(ns)) this.namespaces.set(ns, []); return this.namespaces.get(ns); }

  upsertMany(ns, items) {
    const arr = this._ns(ns);
    for (const it of items) {
      const id = it.id || hashId(`${ns}:${it.ts || ''}:${it.chunk || ''}:${Math.random()}`);
      const rec = { id, vector: Float32Array.from(it.vector || []), text: String(it.text || ''), metadata: it.metadata || {} };
      arr.push(rec);
    }
    return { count: items.length };
  }

  query(ns, queryVec, topK = 5, withText = true) {
    const arr = this._ns(ns);
    const q = Float32Array.from(queryVec || []);
    const scored = [];
    for (const rec of arr) {
      const score = cosine(q, rec.vector);
      scored.push({ id: rec.id, score, text: withText ? rec.text : undefined, metadata: rec.metadata });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

export const store = new MemoryStore();

