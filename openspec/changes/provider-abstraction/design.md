## Context

The codebase already branches on provider selection, but each branch still uses Anthropic SDK clients or Anthropic-specific model assumptions. Core request execution, token estimation, tool schemas, and message block handling are shaped around Anthropic message types, while bridge/session/OAuth flows depend on Anthropic-specific APIs and headers.

The requested enterprise direction is broader than adding another endpoint. Azure OpenAI and direct OpenAI introduce different request shapes, streaming event formats, tool-call payloads, authentication models, and model naming. A provider abstraction is needed so the terminal product can support multiple backends without duplicating REPL logic or weakening behavior parity.

Implementation-oriented review findings that materially affect this design:
- The main inference path runs through `query()` in `src/query.ts`.
- `query()` gets its model-call dependency from `src/query/deps.ts`, where `callModel` currently points to `queryModelWithStreaming` in `src/services/api/claude.ts`.
- This `query()` -> `callModel` seam is the narrowest viable insertion point for provider abstraction.
- `src/services/api/claude.ts` is the main concentration of protocol logic today: request construction, streaming handling, non-streaming fallback, usage accumulation, and tool-use parsing all live there.
- Upper layers such as `src/query.ts`, `src/services/tools/toolExecution.ts`, `src/services/tools/StreamingToolExecutor.ts`, and `src/Tool.ts` depend on Anthropic-style internal message shapes such as `tool_use` and `tool_result`.
- Because of that dependency, the first implementation phase must normalize provider output into the existing internal tool/message model rather than trying to replace the upper-layer message contract immediately.
- Current provider selection is spread across env-based checks such as `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, and `CLAUDE_CODE_USE_FOUNDRY`, with no provider-neutral selection model yet.
- Current model selection and model picker behavior are strongly organized around Claude families such as `sonnet`, `opus`, and `haiku`, so provider-aware model resolution is a required companion change.
- The existing `foundry` path is based on `@anthropic-ai/foundry-sdk` and must not be treated as Azure OpenAI compatibility.

## Goals / Non-Goals

**Goals:**
- Define a stable provider interface for the primary inference path.
- Separate generic inference behavior from Anthropic-only remote/session integrations.
- Support provider selection and credential resolution for Claude, OpenAI, and Azure OpenAI.
- Keep existing Anthropic-compatible providers working during migration.
- Make unsupported capabilities explicit instead of silently assuming provider parity.

**Non-Goals:**
- Replacing Anthropic OAuth, remote-control, bridge sessions, or session-ingress with provider-neutral implementations in this change.
- Redesigning terminal UI or enterprise branding.
- Delivering a web version of the product.
- Guaranteeing that every provider supports identical advanced features in phase one.
- Replacing the current internal `tool_use` / `tool_result` contract across the entire application in phase one.

## Decisions

### 1. Introduce a provider adapter boundary around inference, not around the entire product

Create a shared provider contract for:
- request construction and execution
- streaming event normalization
- tool-call request/response translation
- token estimation
- error normalization
- capability advertisement

Higher-level REPL, transcript, permission, and tool orchestration code should consume normalized events and provider capabilities rather than importing provider SDK types directly.

Why this approach:
- It isolates the most protocol-sensitive surface first.
- It avoids blocking on a full rewrite of remote/session subsystems.
- It supports staged migration of existing Anthropic branches.
- It aligns with the existing `query()` dependency seam, which allows implementation to start at the model-call boundary instead of at the UI boundary.

Alternatives considered:
- Add `openai` and `azure-openai` as more enum values in the current branching model. Rejected because the current branch points still assume Anthropic SDK types.
- Build a universal platform abstraction covering OAuth, sessions, remote control, and inference at once. Rejected because it is too broad for a first enterprise change.

### 2. Treat Anthropic-only remote/session flows as provider-specific integrations

Bridge session creation, session ingress, claude.ai OAuth, and related APIs remain outside the generic provider abstraction. The generic provider layer covers only local and direct inference workflows in phase one.

Why this approach:
- These flows are not portable to Azure OpenAI or direct OpenAI.
- Forcing them into a generic abstraction now would add false uniformity and delay the foundational work.

Alternatives considered:
- Define a universal session API now. Rejected because there is no evidence the non-Anthropic providers need or can support the current semantics.

### 3. Add explicit provider capabilities instead of assuming feature parity

Each provider adapter should declare whether it supports:
- streaming
- tool calls
- token estimation
- model alias resolution
- remote/session features

Callers use these capabilities to gate behavior, diagnostics, and fallback paths.

Why this approach:
- Azure OpenAI and OpenAI may differ from Anthropic-compatible paths at launch.
- It prevents hidden regressions caused by implicit assumptions in the UI or orchestration layer.
- It lets the existing upper layers keep their current control flow while unsupported features are surfaced deliberately rather than failing deep inside protocol handling.

Alternatives considered:
- Hardcode parity and patch exceptions later. Rejected because it spreads conditional logic and increases runtime surprises.

### 4. Normalize configuration across CLI flags, env vars, and settings

Provider selection and model resolution should follow a documented precedence order and validate provider-specific credentials before first request.

Initial target providers:
- `claude`
- `openai`
- `azure-openai`

Existing Anthropic-compatible deployment paths can continue to map internally as needed during migration, but external enterprise configuration should move toward clearer provider naming.

Why this approach:
- Enterprise deployments need predictable configuration behavior.
- Provider-specific auth and model rules differ too much to leave implicit.

Alternatives considered:
- Keep environment-variable-only selection. Rejected because enterprise rollouts need auditable and debuggable configuration precedence.

### 5. Preserve the current internal tool/message contract in phase one

Provider adapters should normalize external provider payloads into the current internal message and tool-call representation consumed by `query()` and the tool execution stack.

Why this approach:
- The tool execution pipeline is deeply built around `tool_use` and `tool_result`.
- Replacing that contract at the same time as provider abstraction would broaden the change substantially and increase migration risk.

Alternatives considered:
- Replace the entire internal message contract with a provider-neutral representation immediately. Rejected because too many upper-layer modules currently assume Anthropic-style content blocks.

## Risks / Trade-offs

- [Risk] Existing code imports Anthropic SDK types across many modules. -> Mitigation: introduce normalized types at the new boundary first, then migrate call sites incrementally.
- [Risk] Token estimation and tool-call semantics may not match across providers. -> Mitigation: encode provider capabilities and allow phase-one fallbacks where exact parity is unavailable.
- [Risk] Users may assume Azure OpenAI also supports current Anthropic remote/session features. -> Mitigation: document those features as Anthropic-only in this change and expose clear diagnostics.
- [Risk] Renaming provider concepts could disrupt current internal deployment paths. -> Mitigation: keep compatibility shims for existing Anthropic-compatible branches during the migration.
- [Risk] Streaming behavior is more complex than plain request execution because watchdogs, fallback behavior, and tool-use handling are embedded in `src/services/api/claude.ts`. -> Mitigation: preserve the query/tool pipeline and move provider-specific streaming normalization behind the adapter boundary incrementally.
- [Risk] Current model picker and alias logic assume Claude family concepts, which can leak wrong assumptions into new providers. -> Mitigation: sequence provider-aware model resolution work alongside provider abstraction rather than bolting it on afterward.

## Migration Plan

1. Introduce normalized provider interfaces and adapters without removing existing Anthropic behavior.
2. Move the main inference path to the `query()` model-call boundary while preserving the current upper-layer tool and message contract.
3. Wrap the existing Anthropic-compatible paths behind the new adapter boundary before adding new providers.
4. Add configuration resolution and validation for OpenAI and Azure OpenAI.
5. Gate unsupported features through provider capabilities and diagnostics.
6. Once the new path is stable, remove direct Anthropic SDK dependencies from higher-level orchestration modules where practical.

Rollback strategy:
- Keep the existing Anthropic-compatible path available behind compatibility wiring until the new abstraction is validated.
- Avoid changing remote/session behavior in the same rollout so rollback stays limited to the inference layer.

## Open Questions

- Should enterprise-facing configuration expose `anthropic` or `claude` as the user-facing provider name?
- Is Azure OpenAI phase one required to support the same tool-call semantics as the current Anthropic path, or is reduced capability acceptable initially?
- Should model aliases be standardized across providers, or should aliases remain provider-specific with explicit mapping tables?
