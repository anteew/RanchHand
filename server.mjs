import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { listModels, chatCompletion, embeddings } from './src/oai_client.mjs';

const server = new Server({ name: 'ranchhand-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });

const tools = new Map();
function registerTool(def, handler) { tools.set(def.name, { def, handler }); }

registerTool({
  name: 'openai_models_list',
  description: 'List models from OpenAI-compatible backend (GET /v1/models).',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
}, async () => {
  try { const out = await listModels(); return { ok: true, ...out }; }
  catch (e) { return { ok: false, reason: String(e) }; }
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
      stream: { type: 'boolean' },
    },
    required: ['messages'],
    additionalProperties: false,
  },
}, async ({ model, messages, temperature, top_p, max_tokens, stream: _stream }) => {
  try { const res = await chatCompletion({ model, messages, temperature, top_p, max_tokens, stream: false }); return { ok: true, text: res.text, raw: res.raw }; }
  catch (e) { return { ok: false, reason: String(e) }; }
});

registerTool({
  name: 'openai_embeddings_create',
  description: 'Create embeddings (POST /v1/embeddings).',
  inputSchema: { type: 'object', properties: { model: { type: 'string' }, input: {} }, required: ['input'], additionalProperties: false },
}, async ({ model, input }) => {
  try { const out = await embeddings({ model, input }); return { ok: true, ...out }; }
  catch (e) { return { ok: false, reason: String(e) }; }
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
