# RanchHand — OpenAI-compatible MCP Server

RanchHand is a minimal MCP server that fronts an OpenAI-style API. It works great with Ollama's OpenAI-compatible endpoints (http://localhost:11434/v1) and should work with other OpenAI-compatible backends.

## Features
- Tools:
  - `openai_models_list` → GET `/v1/models`
  - `openai_chat_completions` → POST `/v1/chat/completions`
  - `openai_embeddings_create` → POST `/v1/embeddings`
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
