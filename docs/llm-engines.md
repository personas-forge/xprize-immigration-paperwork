# LLM engines

All AI routes call one wrapper — `getLlm()` in `src/lib/llm/client.ts` — instead
of talking to a model SDK directly. The wrapper exposes a single method:

```ts
const llm = getLlm();                 // null → use the template fallback
const text = await llm.generate(prompt, { json: true, tier: "fast" | "long" });
// llm.name is "gemini" | "claude" → becomes the result `source`
```

## Engines

| Engine | When | Auth | Notes |
|---|---|---|---|
| **Gemini** | default / production | `GEMINI_API_KEY` | `@google/generative-ai` SDK. `tier:"long"` uses `GEMINI_DRAFT_MODEL`. |
| **Claude Code CLI** | local dev / testing | your local `claude` login (subscription) | Shells out to `claude -p`, prompt on **stdin**. No API key, no per-token billing. |
| *(none)* | no secret configured | — | Each route returns its deterministic, disclaimer-bearing template. |

## Switching

Set `LLM_ENGINE` (see `.env.example`):

- unset / `auto` → Gemini when `GEMINI_API_KEY` is set, else template fallback (unchanged default).
- `gemini` → force Gemini (still needs the key).
- `claude` → force the Claude Code CLI. `CLAUDE_CLI_PATH` (default `claude`) and `CLAUDE_CLI_MODEL` (default `sonnet`) tune it.

The CLI is **never** selected implicitly — spawning a subprocess is an explicit
opt-in. It is intended for **local** iteration; Cloud Run has no interactive
login.

## Images / multimodal

The Claude CLI engine does **not** process images. Image/multimodal operations
must call `getLlm({ requiresImages: true })`, which can only return the Gemini
engine (or `null`). No operation sends images today; this guards the future
Document AI / OCR work in the evidence vault.

## Adding an engine

1. Implement an `Llm` in `client.ts` (a `name` + `generate`).
2. Extend `resolveEngine()` / `LlmEngine` in `config.ts`.
3. Add its name to `ModelSource` in `label.ts` and `sourceLabel()`.

Routes and UI need no changes — they only ever see `llm.generate()` and the
`source` string.
