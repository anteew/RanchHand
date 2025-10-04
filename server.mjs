import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const OAI_BASE = process.env.OAI_BASE || 'http://localhost:11434/v1';
const OAI_API_KEY = process.env.OAI_API_KEY || '';
const OAI_DEFAULT_MODEL = process.env.OAI_DEFAULT_MODEL || 'llama3:latest';
const OAI_TIMEOUT_MS = parseInt(process.env.OAI_TIMEOUT_MS || '60000', 10);

async function httpJson(path, { method = 'GET', body } = {}) {
  const url = path.startsWith('http') ? path : `${OAI_BASE.replace(/\/$/, '')}${path}`;
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

const server = new Server({ name: 'ranchhand-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });

const tools = new Map();
function registerTool(def, handler) { tools.set(def.name, { def, handler }); }

registerTool({
  name: 'openai_models_list',
  description: 'List models from OpenAI-compatible backend (GET /v1/models).',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
}, async () => {
  try {
    const out = await httpJson('/models');
    return { ok: true, ...out };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
});

registerTool({
  name: 'openai_chat_completions',
  description: 'Create chat completion (POST /v1/chat/completions).',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string' },
      messages: { type: 'array' },
      temperature: { type: 'number' },
      top_p: { type: 'number' },
      max_tokens: { type: 'number' },
      stream: { type: 'boolean' }
    },
    required: ['messages'],
    additionalProperties: false,
  },
}, async ({ model, messages, temperature, top_p, max_tokens, stream }) => {
  try {
    const body = { model: model || OAI_DEFAULT_MODEL, messages, temperature, top_p, max_tokens, stream: false };
    const out = await httpJson('/chat/completions', { method: 'POST', body });
    return { ok: true, ...out };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
});

registerTool({
  name: 'openai_embeddings_create',
  description: 'Create embeddings (POST /v1/embeddings).',
  inputSchema: { type: 'object', properties: { model: { type: 'string' }, input: {} }, required: ['input'], additionalProperties: false },
}, async ({ model, input }) => {
  try {
    const body = { model: model || OAI_DEFAULT_MODEL, input };
    const out = await httpJson('/embeddings', { method: 'POST', body });
    return { ok: true, ...out };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const list = Array.from(tools.values()).map((t) => t.def);
  return { tools: list };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const entry = tools.get(name);
  if (!entry) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'tool-not-found', name }) }], isError: true };
  try {
    const result = await entry.handler(args || {});
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (e) {
    return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: String(e) }) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stdin.resume();

