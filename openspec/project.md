# Project Context

## Purpose
This repository is an internal mirror of Claude Code, adapted for enterprise use.
The near-term goal is to maintain a stable terminal-first AI coding assistant while preparing for enterprise-specific changes such as model provider replacement, enterprise UI customization, and possible remote or web-based delivery in later phases.

## Tech Stack
- TypeScript with ESM-style imports
- Node.js 18+
- Bun-related feature flags and bundled runtime paths are present in the codebase
- React + Ink for terminal UI
- Custom terminal design system and theme layer
- HTTP and WebSocket session flows for bridge and direct-connect modes

## Project Conventions

### Code Style
- Preserve the surrounding file style; do not mass-reformat unrelated files.
- Prefer small, focused changes over broad refactors.
- Keep public APIs and protocol shapes stable unless the task explicitly changes them.
- Use existing module boundaries and lazy import patterns where they already exist.
- Maintain source imports in the existing project style, including explicit `.js` import suffixes in TypeScript source where already used.

### Architecture Patterns
- The product is terminal-first today, with the main interactive entry path centered around the CLI and Ink-based UI.
- UI rendering is wrapped through the local Ink abstraction and theme provider, rather than using raw Ink directly everywhere.
- Stateful runtime behavior is distributed across bootstrap state, app state stores, bridge flows, server flows, and service utilities.
- Model, auth, and session behavior currently contain upstream Claude/Anthropic assumptions in multiple places, especially around bridge and session creation logic.
- The repository already includes a direct-connect server/session path, which is relevant for future enterprise remote-access scenarios.

### Testing Strategy
- A quick initialization scan did not confirm top-level test, lint, or typecheck scripts yet; verify the actual commands before relying on automation.
- For enterprise-facing changes, require validation per task rather than waiting until the end of a large change.
- Changes involving model providers, auth, session creation, streaming, or protocol parsing must include focused validation for success and failure paths.
- When automated coverage is incomplete, document manual verification steps and observed results for each completed task.
- Do not draft large change proposals under the assumption that existing quality gates are sufficient until a deeper code review is completed.

### Git Workflow
- Use OpenSpec changes to scope work by capability, not by broad initiative.
- Prefer one major capability per change proposal.
- Keep tasks small enough to validate independently.
- Complete validation for the current task before moving to the next one.
- Avoid large cross-cutting edits before targeted code review confirms the actual integration points.

## Domain Context
- This is a Claude Code mirror intended for enterprise adaptation rather than a greenfield product.
- Expected enterprise requirements include provider replacement or abstraction, especially Azure OpenAI support, while possibly preserving compatibility with Claude or OpenAI-style providers.
- UI changes may be required for enterprise branding and usage constraints.
- A later web-accessible workspace model is being considered, but should be treated as a separate architecture effort rather than a simple UI port.

## Current Workstreams
- Workstream 1: Replace or abstract upstream model-provider coupling so enterprise deployments can use approved providers.
- Workstream 2: Support enterprise Azure OpenAI as a model source, while keeping room for configurable Claude or OpenAI-style providers where policy allows.
- Workstream 3: Apply enterprise-specific UI and branding changes on top of the existing terminal-first product.
- Workstream 4: Explore a future web-accessible workspace experience for internal users, but only as a later-phase architecture effort.

## Current Priorities
- Priority 1: Perform a deeper code review of model, auth, session, streaming, and protocol handling before proposing major changes.
- Priority 2: After review, define a provider-abstraction change rather than attempting an Azure migration as scattered endpoint edits.
- Priority 3: Defer major UI redesign and web-platform planning until the provider and protocol boundaries are better understood.

## Current Phase Notes
- For the current provider-abstraction phase, broader Anthropic-only feature audits outside the already-touched high-visibility entry points are tracked as follow-up work, not as immediate blockers for configurable `claude/openai/azure-openai` inference.
- Automated validation remains important for completion confidence and task-state accuracy, but missing local test tooling is currently treated as a validation gap rather than a direct runtime blocker when code-path review and targeted remediation have already landed.
- When automated validation is unavailable in the working environment, execution records should explicitly distinguish:
  - code-path verification
  - executed tests
  - deferred validation follow-up

## Implementation-Oriented Code Review Findings

### End-to-End Inference Path
- The main inference path is centered on `query()` in `src/query.ts`.
- `query()` receives its model-call dependency from `src/query/deps.ts`, where `callModel` currently resolves to `queryModelWithStreaming` from `src/services/api/claude.ts`.
- This dependency injection point is the narrowest viable seam for introducing provider abstraction without rewriting the REPL or tool orchestration layers first.

### Core Provider Coupling
- The largest concentration of provider and protocol coupling is in `src/services/api/claude.ts`.
- That file currently owns request construction, streaming execution, non-streaming fallback, usage accumulation, tool-use parsing, and several Anthropic-specific response assumptions.
- Existing "multi-provider" support is not generic. It branches between `firstParty`, `bedrock`, `vertex`, and `foundry`, but those branches still assume Anthropic SDK types or Anthropic-compatible semantics.

### Current Provider Selection Model
- `src/utils/model/providers.ts` determines the active provider almost entirely from environment flags:
  - `CLAUDE_CODE_USE_BEDROCK`
  - `CLAUDE_CODE_USE_VERTEX`
  - `CLAUDE_CODE_USE_FOUNDRY`
- There is no current provider-neutral configuration layer for `claude`, `openai`, or `azure-openai`.
- Because provider choice is read in many places, the `provider-selection-ux` change must centralize precedence before adding more providers.

### Model Resolution Coupling
- Model defaults, aliases, and picker options are strongly organized around Claude model families such as `sonnet`, `opus`, and `haiku`.
- `src/utils/model/model.ts`, `src/utils/model/modelStrings.ts`, and `src/utils/model/modelOptions.ts` all assume Claude-oriented naming and provider-specific remapping within that family.
- The current model UX is not ready for OpenAI-compatible providers without a provider-aware model resolution layer.

### Tool Calling And Internal Message Shape
- `src/query.ts`, `src/services/tools/toolExecution.ts`, `src/services/tools/StreamingToolExecutor.ts`, and `src/Tool.ts` rely heavily on Anthropic-style `tool_use` and `tool_result` message blocks.
- This means provider abstraction cannot stop at HTTP transport or SDK selection. Non-Anthropic providers must be normalized into the existing internal tool-call shape, or the upper layers will require broader rewrites.

### Streaming Complexity
- `src/services/api/claude.ts` contains substantial streaming control logic, including watchdog timers, stall detection, non-streaming fallback, fallback-on-404 behavior, and tool-use event handling.
- Replacing streaming behavior provider-by-provider will be higher risk than replacing plain request execution.
- The safest early path is to preserve the query/tool pipeline and introduce normalized provider stream events at the adapter boundary.

### Authentication And Credential Boundaries
- `src/utils/auth.ts` treats Bedrock, Vertex, and Foundry as provider-specific credential paths that bypass the main Claude OAuth flow.
- This is useful for future Azure OpenAI support because Azure/OpenAI can be integrated as provider-specific auth paths rather than trying to fit into Claude OAuth.
- At the same time, auth logic currently assumes Anthropic API keys and Claude OAuth as the central default, so OpenAI-compatible providers will require explicit credential validation and diagnostics.

### Managed Environment And Security Boundary
- `src/utils/managedEnv.ts` treats values such as `ANTHROPIC_BASE_URL` as sensitive because settings-based env injection can redirect traffic.
- Provider-selection work must account for which environment variables may be set through managed settings and which variables are too sensitive to expose loosely.
- This is an implementation concern, not just a UX concern.

### Status And Diagnostics Surface
- `src/utils/status.tsx` already exposes provider-related status, but only for current Anthropic-oriented provider modes such as first-party, Bedrock, and Microsoft Foundry.
- There is no current status surface for OpenAI or Azure OpenAI-specific endpoint, deployment, API-version, or capability diagnostics.
- The `provider-selection-ux` change should reuse this existing status surface instead of inventing a parallel diagnostics path.

### Azure-Specific Architectural Clarification
- The existing `foundry` path in `src/services/api/client.ts` uses `@anthropic-ai/foundry-sdk` and should not be treated as Azure OpenAI support.
- It represents Anthropic-compatible delivery through Microsoft infrastructure, not an OpenAI-compatible Azure OpenAI protocol path.
- Future Azure OpenAI support must be implemented as a distinct provider adapter.

### Recommended Implementation Order
- Step 1: Introduce provider abstraction at the `query()` -> `callModel` boundary.
- Step 2: Create normalized provider result and stream event types that preserve the current upper-layer tool/message contract.
- Step 3: Wrap the existing Anthropic-compatible paths behind the new adapter interface before adding new providers.
- Step 4: Centralize provider selection and provider-aware model resolution.
- Step 5: Add Azure OpenAI as a new provider adapter after the generic boundary is stable.

### Explicit Non-Goals For Early Implementation
- Do not treat bridge/session-ingress/claude.ai remote-control flows as part of the generic provider abstraction in the first implementation phase.
- Do not treat a base-URL swap or Foundry reuse as sufficient for Azure OpenAI support.
- Do not begin by rewriting UI model pickers or remote session features before the inference boundary is stabilized.

## Review Restart Notes
- This document is intended to help another researcher restart review and design work without assuming prior conversation context.
- The most important open question is where Anthropic-specific assumptions are embedded across auth, request headers, model naming, streaming, session creation, and response parsing.
- A follow-up reviewer should map the end-to-end model invocation path before drafting any large OpenSpec change proposal.
- Review should explicitly separate terminal UI concerns from provider/protocol concerns and from future web-platform concerns.
- Do not treat the future web platform as an incremental UI task; validate whether it should reuse core logic selectively or be designed as a separate product surface.

## Important Constraints
- Enterprise security requirements may require replacing upstream API endpoints, auth flows, and request or response formats.
- Current code appears to embed Anthropic-specific headers, auth assumptions, and session semantics in multiple locations; provider swaps are not a simple base URL change.
- Terminal UX is the current primary product shape; web delivery should be evaluated only after deeper code review.
- The repository is large and includes bundled, vendor, and generated-adjacent material, so changes should be targeted and conservative.
- Because engineering complexity is high, perform a deeper code review before designing major OpenSpec change proposals.

## External Dependencies
- Upstream Claude/Anthropic-related auth and session APIs
- Potential future Azure OpenAI enterprise endpoints
- Git and GitHub repository metadata for session context and workflows
- HTTP and WebSocket direct-connect server APIs
- Internal plugin, MCP, telemetry, and remote-session subsystems already present in the repository
