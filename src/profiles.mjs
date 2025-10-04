import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const TWI_DIR = path.join(os.homedir(), '.threadweaverinc');
const RH_DIR = path.join(TWI_DIR, 'ranchhand');
export const profilesPath = path.join(RH_DIR, 'profiles.json');

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch (_) {} }

const DEFAULTS = {
  embed: { model: 'nomic-embed-text:latest' },
  summarize_storage: { model: 'llama3:latest', temperature: 0.2, max_tokens: 512 },
  summarize_retrieval: { model: 'llama3:latest', temperature: 0.1, max_tokens: 256 },
  rerank: { model: 'bge-reranker:latest' },
  intent: { model: 'phi4:3.8b', temperature: 0.0 },
  chunking: { chunk_tokens: 512, overlap_tokens: 50 },
};

let cache = null;

export function getProfiles() {
  if (cache) return cache;
  try {
    const txt = fs.readFileSync(profilesPath, 'utf8');
    const obj = JSON.parse(txt);
    cache = { ...DEFAULTS, ...obj };
    // Shallow merge sections
    for (const k of Object.keys(DEFAULTS)) {
      cache[k] = { ...DEFAULTS[k], ...(obj?.[k] || {}) };
    }
  } catch (_) {
    cache = JSON.parse(JSON.stringify(DEFAULTS));
  }
  return cache;
}

function deepMerge(a, b) {
  const out = Array.isArray(a) ? a.slice() : { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = deepMerge(out[k] || {}, v);
    else out[k] = v;
  }
  return out;
}

export function mergeProfiles(patch) {
  const current = getProfiles();
  const next = deepMerge(current, patch || {});
  ensureDir(RH_DIR);
  const tmp = profilesPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, profilesPath);
  cache = next;
  return cache;
}

