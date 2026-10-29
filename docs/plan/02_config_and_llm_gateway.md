# 02 - Runtime config and LLM gateway

## Objective
The frontend sends the complete model configuration; the backend makes every model call. Provide fakes for all later tests.

## Config model (`schemas/config.py`)
```python
class ModelRoleConfig(BaseModel):
    base_url: AnyHttpUrl
    model: str
    api_key: SecretStr | None
    system_instructions: str = ""
    temperature: float = 0.0
    max_tokens: int | None = None
    timeout_s: float = 120
    extra_headers: dict[str,str] = {}
    extra_body: dict[str,Any] = {}
    supports_json_schema: bool | None = None   # None = auto-detect
class EmbeddingConfig(ModelRoleConfig):
    dimensions: int | None = None               # auto-detected by test
    query_prefix: str = ""; document_prefix: str = ""; batch_size: int = 32
class RerankConfig(BaseModel):
    mode: Literal["none","endpoint","llm"] = "none"
    base_url: AnyHttpUrl | None; model: str | None; api_key: SecretStr | None
    top_n: int = 10
class AppConfig(BaseModel):
    chat: ModelRoleConfig          # answers
    extraction: ModelRoleConfig    # claim/entity/finding extraction
    linking: ModelRoleConfig       # link classification
    embedding: EmbeddingConfig
    rerank: RerankConfig
    concurrency: int = 4
    token_budget_per_job: int | None = None
```
Roles may reuse the same endpoint; UI offers "copy from chat".

## Endpoints
- `GET /api/config` -> config with api keys masked (`"api_key_set": true`).
- `PUT /api/config` -> validate, persist. Non-secret parts in SQLite `settings` table; API keys in OS keychain via `keyring` (fallback: in-memory only + warning flag if keychain unavailable). Absent `api_key` in PUT means "keep existing"; explicit `null` clears.
- `POST /api/config/test` body optional `{role}`: performs a tiny call per role; returns `{role, ok, latency_ms, error?, detected: {dimensions?, supports_json_schema?, models_listed?}}`. Embedding test detects dimensions from the response. JSON-schema detection: try `response_format={"type":"json_schema",...}` with a trivial schema; on 400/unsupported mark False.
- `GET /api/config/models?role=` -> proxies `GET {base_url}/models` if available.

## Gateway (`app/gateway/`)
- `LLMClient.chat(messages, role, response_model: type[BaseModel]|None, stream=False)`:
  - uses `openai.AsyncOpenAI(base_url, api_key or "none", timeout, default_headers)`.
  - Prepends role `system_instructions` unless the call supplies its own system prompt (then concatenate: role instructions first).
  - Structured output: if `supports_json_schema` use `response_format` json_schema; else JSON mode / prompt-instructed JSON; always validate with Pydantic; on failure retry up to 2 times feeding back the validation error.
  - Retries with exponential backoff + jitter on 429/5xx/timeouts; global `asyncio.Semaphore(concurrency)`.
  - Token usage accounting per job (`usage` table) and budget enforcement.
- `Embedder.embed(texts, kind: "query"|"document")`: applies prefixes, batches, orders results, normalises vectors (L2) and returns `np.ndarray`. Records `embedding_fingerprint = sha1(base_url+model+dimensions+prefixes)`.
- `Reranker.rerank(query, docs)`: modes none (identity), endpoint (POST `{model, query, documents, top_n}`; parse `results[].index/relevance_score`), llm (pointwise 0-10 scoring with batch prompt).
- `cache.py`: SQLite table `llm_cache(key, response_json, created_at)`; key = sha256(role model + prompt_version + messages + schema). Enabled for extraction/linking; bypass flag in config.
- Offline hint: `GET /api/config/network-status` returns whether each base_url host is loopback/private (UI banner when not local).
- **Fakes** in `tests/fakes.py`: `FakeLLM` (rule-based responses registered per test), `FakeEmbedder` (deterministic hash-based vectors, dim 64), `FakeReranker`. Provide a pytest fixture overriding the FastAPI dependencies.
- Contract tests against a local mock OpenAI server (use `respx`/`httpx` mock) for chat, embeddings, errors, retries.

## Frontend
Settings page: tabs per role with all fields, masked key input, "Test connection" buttons showing results, "Copy from chat", dirty-state tracking, save. Store config in server only (never localStorage for keys).

## Tests
Config round-trip with masking; key never present in logs or responses (assert); retry/backoff; structured-output retry loop; dimension detection; UI tests for form and masked key.

## Acceptance
User can configure endpoints in UI, hit Test, see green results against a mock server; ci passes.
