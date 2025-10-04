# RanchHand — OpenAI-compatible MCP Server ([Architecture](ARCHITECTURE.md))

RanchHand is a minimal MCP server that fronts an OpenAI-style API. It works great with Ollama's OpenAI-compatible endpoints (http://localhost:11434/v1) and should work with other OpenAI-compatible backends.

## Features
- Tools:
  - `openai_models_list` → GET `/v1/models`
  - `openai_chat_completions` → POST `/v1/chat/completions`
  - `openai_embeddings_create` → POST `/v1/embeddings`
  - Optional HTTP ingest on localhost:41414 (bind 127.0.0.1):
    - `POST /ingest/slack` (index: chunk + embed + upsert in in-memory store)
    - `POST /query` (kNN query with embeddings)
    - `GET /profiles` | `POST /profiles` (role defaults: embed, summarizers, reranker, chunking)
    - `POST /answer` (retrieve + generate answer with bracketed citations)
- Config via env:
  - `OAI_BASE` (default `http://localhost:11434/v1`)
  - `OAI_API_KEY` (optional; some backends ignore it, Ollama allows any value)
  - `OAI_DEFAULT_MODEL` (fallback model name, e.g. `llama3:latest`)
  - `OAI_TIMEOUT_MS` (optional request timeout)

## Run (standalone)
```bash
# Example with Ollama running locally
export OAI_BASE=http://localhost:11434/v1
export OAI_DEFAULT_MODEL=llama3:latest
node server.mjs
```

### HTTP Ingest Service
```bash
node http.mjs
# Binds to 127.0.0.1:41414
# Shared secret is created at ~/.threadweaverinc/auth/shared_secret.txt on first run
```

Example request:
```bash
SECRET=$(cat ~/.threadweaverinc/auth/shared_secret.txt)
curl -s -X POST http://127.0.0.1:41414/ingest/slack \
  -H "Content-Type: application/json" \
  -H "X-Ranchhand-Token: $SECRET" \
  -d '{
    "namespace":"slack:T123:C456",
    "channel":{"teamId":"T123","channelId":"C456"},
    "items":[{"ts":"1234.5678","text":"Hello world","userName":"Dan"}]
  }'
```

Query:
```bash
SECRET=$(cat ~/.threadweaverinc/auth/shared_secret.txt)
curl -s -X POST http://127.0.0.1:41414/query \
  -H "Content-Type: application/json" \
  -H "X-Ranchhand-Token: $SECRET" \
  -d '{
    "namespace":"slack:T123:C456",
    "query":"hello",
    "topK": 5,
    "withText": true
  }'
```

Answer with citations:
```bash
SECRET=$(cat ~/.threadweaverinc/auth/shared_secret.txt)
curl -s -X POST http://127.0.0.1:41414/answer \
  -H "Content-Type: application/json" \
  -H "X-Ranchhand-Token: $SECRET" \
  -d '{
    "namespace":"slack:T123:C456",
    "query":"What did Dan say about hello?",
    "topK": 3
  }'
```

Profiles:
```bash
curl -s http://127.0.0.1:41414/profiles
curl -s -X POST http://127.0.0.1:41414/profiles \
  -H "Content-Type: application/json" \
  -d '{ "embed": { "model": "nomic-embed-text:latest" }, "chunking": { "chunk_tokens": 512 } }'
```

## MCP Tools
- `openai_models_list`
  - Input: `{}`
  - Output: OpenAI-shaped `{ data: [{ id, object, ... }] }`
- `openai_chat_completions`
  - Input: `{ model?: string, messages: [{ role: 'user'|'system'|'assistant', content: string }], temperature?, top_p?, max_tokens? }`
  - Output: OpenAI-shaped chat completion response (single-shot; streaming TBD)
- `openai_embeddings_create`
  - Input: `{ model?: string, input: string | string[] }`
  - Output: OpenAI-shaped embeddings response

## Claude/Codex (MCP)
Point your MCP config to:
```json
{
  "mcpServers": {
    "ranchhand": {
      "command": "node",
      "args": ["/absolute/path/to/server.mjs"],
      "env": { "OAI_BASE": "http://localhost:11434/v1", "OAI_DEFAULT_MODEL": "llama3:latest" }
    }
  }
}
```

## Notes
- Streaming chat completions are not implemented yet (single response per call). If your backend requires streaming, we can add an incremental content pattern that MCP clients can consume.
- RanchHand passes through OpenAI-style payloads and shapes outputs to be OpenAI-compatible, but exact metadata (usage, token counts) depends on the backend.
 - HTTP ingest is currently an acknowledgment stub (counts + sample). Chunking/embedding/upsert will be wired next; design is pluggable for local store or Qdrant.
