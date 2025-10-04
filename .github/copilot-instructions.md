# Copilot Instructions for RanchHand

## Project Overview

RanchHand is an OpenAI-compatible MCP (Model Context Protocol) server that provides a bridge to local AI models (primarily Ollama) and implements a RAG (Retrieval-Augmented Generation) system with vector storage capabilities.

**Core Components:**
- **MCP Server** (`server.mjs`): Exposes MCP tools for model listing, chat completions, and embeddings
- **HTTP Service** (`http.mjs`): Provides HTTP endpoints for document ingestion, querying, and answer generation
- **OpenAI Client** (`src/oai_client.mjs`): Handles communication with OpenAI-compatible backends
- **Vector Store** (`src/store_memory.mjs`): In-memory vector storage with cosine similarity search
- **Profiles** (`src/profiles.mjs`): Persistent configuration for models and parameters
- **CLI** (`cli.mjs`): Command-line interface for testing and interaction

See [ARCHITECTURE.md](../ARCHITECTURE.md) for detailed design decisions and vision.

## Code Style & Conventions

### JavaScript/ESM
- **Module System**: ES modules (`.mjs` extension, `type: "module"` in package.json)
- **Node.js Version**: Requires Node.js 18+ (for native fetch API)
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Indentation**: 2 spaces
- **Variable Declaration**: Use `const` by default, `let` when reassignment is needed, never `var`
- **Functions**: Prefer arrow functions for callbacks and closures
- **Naming**: camelCase for variables/functions, UPPER_SNAKE_CASE for constants

### Linting
- ESLint configuration in `eslint.config.js` (flat config format)
- Run `npm run lint` to check for issues
- Run `npm run lint:fix` to auto-fix issues
- CI enforces linting on all PRs
- Unused variables prefixed with `_` are allowed (e.g., `_stream`)

### Error Handling
- Wrap async operations in try-catch blocks
- Return structured error objects: `{ ok: false, error: 'error-type', detail?: string }`
- Log errors sparingly; avoid console.log except in CLI scripts
- For HTTP endpoints, use appropriate status codes (400 for bad requests, 401 for auth, 500 for server errors)

## Architecture Patterns

### MCP Tools Pattern
```javascript
registerTool({
  name: 'tool_name',
  description: 'Brief description of what the tool does.',
  inputSchema: {
    type: 'object',
    properties: { /* ... */ },
    required: ['requiredField'],
    additionalProperties: false,
  },
}, async (args) => {
  try {
    // Implementation
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
});
```

### HTTP Endpoint Pattern
- All HTTP endpoints require `X-Ranchhand-Token` header (except GET /secret debug endpoint)
- Bind only to localhost (127.0.0.1) for security
- Use `parseJson(req)` helper for request body parsing
- Use `send(res, status, obj)` helper for JSON responses
- Keep payload limits reasonable (10MB max in current implementation)

### OpenAI Client Pattern
- Always provide fallback to `OAI_DEFAULT_MODEL` when model is not specified
- Support optional parameters (temperature, top_p, max_tokens)
- Return both processed text and raw response: `{ text, raw }`
- Streaming is available via async generator for Node.js clients

## Environment Configuration

Required/Optional environment variables:
- `OAI_BASE`: OpenAI-compatible API base URL (default: `http://localhost:11434/v1`)
- `OAI_API_KEY`: API key (optional; Ollama doesn't require it)
- `OAI_DEFAULT_MODEL`: Fallback model name (default: `llama3:latest`)
- `OAI_TIMEOUT_MS`: Request timeout in milliseconds (default: 60000)
- `RANCHHAND_HOST`: HTTP service bind address (default: `127.0.0.1`)
- `RANCHHAND_PORT`: HTTP service port (default: `41414`)
- `RH_CHUNK_WORDS`: Chunking word count (default: 512)

## File Persistence

- Shared secret: `~/.threadweaverinc/auth/shared_secret.txt` (auto-created with 0600 permissions)
- Profiles: `~/.threadweaverinc/ranchhand/profiles.json`
- Always use `ensureDir()` before writing files
- Use atomic writes (write to `.tmp`, then rename)

## Security Considerations

- **Localhost Only**: HTTP service binds to 127.0.0.1, never 0.0.0.0
- **Token Authentication**: All HTTP endpoints require shared secret token
- **No Secrets in Code**: Never hardcode credentials; use environment variables
- **File Permissions**: Shared secret file created with mode 0600
- **Payload Limits**: Enforce reasonable size limits to prevent DoS

## Testing & Development

### Manual Testing
```bash
# Install dependencies
npm ci

# Lint code
npm run lint

# Start MCP server (requires Ollama or compatible backend)
export OAI_BASE=http://localhost:11434/v1
node server.mjs

# Start HTTP service
node http.mjs

# CLI examples
node cli.mjs models
node cli.mjs chat -m "Hello" --model llama3:latest
node cli.mjs embed --input "test text"
```

### HTTP Testing
```bash
SECRET=$(cat ~/.threadweaverinc/auth/shared_secret.txt)
curl -X POST http://127.0.0.1:41414/ingest/slack \
  -H "Content-Type: application/json" \
  -H "X-Ranchhand-Token: $SECRET" \
  -d '{"namespace":"test","items":[{"text":"sample"}]}'
```

## Common Patterns

### Adding a New MCP Tool
1. Use `registerTool()` with proper schema definition
2. Handle errors gracefully with try-catch
3. Return `{ ok: true, ...data }` on success, `{ ok: false, reason }` on error
4. Keep responses small (MCP is designed for tiny models)

### Adding a New HTTP Endpoint
1. Check authentication with shared secret token
2. Parse JSON body with `parseJson(req)`
3. Validate input and return 400 for bad requests
4. Use `send(res, status, obj)` for responses
5. Add endpoint documentation to README.md

### Modifying OpenAI Client
- Maintain OpenAI API compatibility
- Support both single responses and streaming where appropriate
- Always provide fallback models
- Include timeout handling

## What to Avoid

- **Don't** add console.log statements outside CLI scripts (use them sparingly even there)
- **Don't** use `var` for variable declarations
- **Don't** expose HTTP service on 0.0.0.0 or external interfaces
- **Don't** hardcode model names; use `OAI_DEFAULT_MODEL` fallback
- **Don't** remove existing error handling or make it less specific
- **Don't** add large dependencies without justification
- **Don't** break OpenAI API compatibility
- **Don't** modify streaming behavior without considering backward compatibility

## Future Considerations

- Vector store will evolve from in-memory to persistent (SQLite/Qdrant)
- Token-aware chunking will replace word-based chunking
- Reranker and intent classifier integration planned
- Additional ingest sources (Discord, wikis) will follow the same pattern as Slack

## Questions & Clarifications

When in doubt:
- Check existing patterns in similar files (e.g., other MCP tools, HTTP endpoints)
- Refer to ARCHITECTURE.md for design rationale
- Maintain consistency with OpenAI API specifications
- Keep the implementation minimal and focused
