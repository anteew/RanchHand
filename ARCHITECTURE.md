# RanchHand — Architecture & Vision

Purpose
- RanchHand is an OpenAI‑compatible MCP + HTTP service that powers RAG for local models (e.g., Ollama).
- It exposes MCP tools for simple use and an HTTP API for scalable ingest/query/answer flows.

High‑Level Design
- OpenAI‑compatible client:
  - `src/oai_client.mjs` — list models, embeddings, chat; streaming iterator for chat.
- MCP server:
  - `server.mjs` — tools: `openai_models_list`, `openai_chat_completions`, `openai_embeddings_create`.
  - Non‑streaming responses (tiny‑model friendly). Streaming available to Node clients via the client module.
- HTTP service (localhost only):
  - `http.mjs` — shared secret auth (auto‑created in `~/.threadweaverinc/auth/shared_secret.txt`).
  - Endpoints:
    - `POST /ingest/slack` — chunk→embed→upsert (in‑memory store for MVP)
    - `POST /query` — embed query + kNN cosine
    - `GET|POST /profiles` — role defaults (embed/summarizers/reranker/chunking)
    - `POST /answer` — retrieve + generate answer with bracketed citations [1], [2]
- Vector store (pluggable):
  - `src/store_memory.mjs` — in‑memory MVP; adapter path to SQLite/Qdrant later.
- Profiles:
  - `src/profiles.mjs` — defaults persisted at `~/.threadweaverinc/ranchhand/profiles.json`.

Key Files
- `server.mjs` — MCP surface
- `http.mjs` — HTTP ingest/query/answer
- `src/oai_client.mjs` — OpenAI client (streaming capable)
- `src/store_memory.mjs` — in‑memory vector store
- `src/profiles.mjs` — defaults + persistence
- `cli.mjs` — simple CLI (chat/models/embed)

Security & Policy
- Localhost binding: 127.0.0.1; all HTTP calls require `X-Ranchhand-Token` (shared secret file).
- No large payloads in MCP: keep responses small for tiny models.

Vision
- Serve as the semantic engine for local RAG:
  - Ingest from ThreadWeaver (Slack now; Discord/wiki later) with consistent payloads.
  - Provide tuned role defaults via profiles for consistent behavior.
- Evolution path:
  - Token‑aware chunking; persisted vector store; optional reranker and intent classifier; richer `/answer` templates.
- Remains OpenAI‑compatible for easy swaps (Ollama, other local backends).
