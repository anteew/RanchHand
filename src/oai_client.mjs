const OAI_BASE = process.env.OAI_BASE || 'http://localhost:11434/v1';
const OAI_API_KEY = process.env.OAI_API_KEY || '';
const OAI_DEFAULT_MODEL = process.env.OAI_DEFAULT_MODEL || 'llama3:latest';
const OAI_TIMEOUT_MS = parseInt(process.env.OAI_TIMEOUT_MS || '60000', 10);

function baseUrl() { return OAI_BASE.replace(/\/$/, ''); }

async function httpJson(path, { method = 'GET', body } = {}) {
  const url = path.startsWith('http') ? path : `${baseUrl()}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (OAI_API_KEY) headers['Authorization'] = `Bearer ${OAI_API_KEY}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), OAI_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    const txt = await res.text();
    let json;
    try { json = JSON.parse(txt); } catch (_) { json = { error: { message: txt || 'non-json response' } }; }
    if (!res.ok) throw new Error(json?.error?.message || res.statusText);
    return json;
  } finally {
    clearTimeout(t);
  }
}

export async function listModels() {
  return await httpJson('/models');
}

function extractTextFromChat(out) {
  try {
    const ch0 = out?.choices?.[0];
    if (ch0?.message?.content) return String(ch0.message.content);
    // Fallback: join deltas if present
    const all = (out?.choices || []).map((c) => c?.message?.content || '').join('');
    return String(all || '');
  } catch (_) { return ''; }
}

export async function chatCompletion({ model, messages, temperature, top_p, max_tokens, stream = false } = {}) {
  const body = { model: model || OAI_DEFAULT_MODEL, messages, temperature, top_p, max_tokens, stream: false };
  const out = await httpJson('/chat/completions', { method: 'POST', body });
  const text = extractTextFromChat(out);
  return { text, raw: out };
}

export async function* chatCompletionStream({ model, messages, temperature, top_p, max_tokens } = {}) {
  const url = `${baseUrl()}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (OAI_API_KEY) headers['Authorization'] = `Bearer ${OAI_API_KEY}`;
  const body = JSON.stringify({ model: model || OAI_DEFAULT_MODEL, messages, temperature, top_p, max_tokens, stream: true });
  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} streaming not available`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split(/\n/)) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const payload = s.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content || '';
          if (delta) yield { delta, raw: json };
        } catch (_) { /* ignore bad chunks */ }
      }
    }
  }
}

export async function embeddings({ model, input } = {}) {
  const out = await httpJson('/embeddings', { method: 'POST', body: { model: model || OAI_DEFAULT_MODEL, input } });
  return out;
}

export async function collectStreamToText(iter) {
  const chunks = [];
  for await (const c of iter) chunks.push(c.delta);
  return { text: chunks.join(''), chunks };
}

