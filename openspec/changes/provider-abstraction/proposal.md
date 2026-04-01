## Why

The repository already supports multiple Anthropic-backed deployment paths, but the core inference flow still assumes Anthropic SDK types, model semantics, and session behavior. Supporting Azure OpenAI alongside configurable Claude/OpenAI providers requires a stable provider boundary before enterprise deployments start making scattered protocol-specific edits.

## What Changes

- Introduce a provider abstraction for the main model invocation path so the CLI can route requests through Anthropic-compatible and OpenAI-compatible providers without rewriting higher-level REPL logic.
- Define normalized provider interfaces for request execution, streaming events, tool-call translation, token estimation, and error mapping.
- Add configurable provider selection and credential resolution for enterprise deployments, including Azure OpenAI and direct OpenAI in addition to existing Claude-oriented paths.
- Preserve Anthropic-only session, OAuth, and remote-control flows as explicitly provider-specific integrations rather than treating them as generic inference behavior.

## Capabilities

### New Capabilities
- `model-provider-abstraction`: Unified provider contract for message execution, streaming, tool use, token estimation, and provider-specific response normalization.
- `provider-configuration`: Configurable provider selection, model resolution, and credential validation for Claude, OpenAI, and Azure OpenAI deployments.

### Modified Capabilities

## Impact

- Affects the core API client and message execution path under `src/services/api/` and related model/provider utilities under `src/utils/model/`.
- Introduces new provider-specific adapters and shared normalization layers for streaming, tool calls, and error handling.
- Changes startup configuration and status reporting for provider selection, credentials, and model availability.
- Establishes scope boundaries so Anthropic-specific OAuth/session integrations can remain separate from generic provider-backed inference.
