## Context

The `provider-abstraction` change establishes a shared boundary for inference providers, but Azure OpenAI still needs a concrete adapter and deployment model. Azure OpenAI differs from current Anthropic-compatible paths in four important ways:

- endpoint shape is Azure-specific
- model selection is typically deployment-based rather than direct model-ID based
- authentication may use API keys or Azure identity flows
- streaming and tool-call payloads follow OpenAI-compatible semantics rather than Anthropic block semantics

This change should build on the provider abstraction and avoid reintroducing protocol-specific branching into higher-level REPL code.

## Goals / Non-Goals

**Goals:**
- Implement an Azure OpenAI adapter behind the provider abstraction.
- Support Azure-specific endpoint, deployment, API-version, and credential configuration.
- Normalize Azure OpenAI streaming and tool-call responses into the shared internal provider format.
- Provide clear startup validation and diagnostics for Azure OpenAI deployments.
- Define explicit first-phase capability behavior when Azure OpenAI cannot match Anthropic-compatible behavior exactly.

**Non-Goals:**
- Reworking Anthropic OAuth, bridge sessions, or claude.ai remote-control flows.
- Adding direct OpenAI support in this change.
- Unifying every provider-specific environment variable into a single final naming scheme.
- Delivering full parity for every advanced Anthropic-only feature in the first Azure OpenAI rollout.

## Decisions

### 1. Use deployment-aware Azure OpenAI configuration

Azure OpenAI should be configured using Azure-specific fields:
- base endpoint
- deployment name
- API version
- credential source

The runtime should not assume that Anthropic-style model IDs are directly meaningful to Azure OpenAI requests.

Why this approach:
- Azure OpenAI commonly routes requests through deployment names.
- It avoids fragile alias translation that hides actual deployment configuration.

Alternatives considered:
- Map Claude-style aliases directly to Azure model IDs and send those as-is. Rejected because Azure OpenAI deployments are tenant-defined and may not align with raw model naming.

### 2. Normalize Azure streaming into the shared event model at the adapter boundary

All Azure OpenAI streaming chunks should be translated into the provider abstraction's normalized event stream before they reach higher-level transcript or UI logic.

Why this approach:
- It preserves the architectural goal of the provider abstraction.
- It prevents Azure-specific chunk parsing from leaking into REPL and tool orchestration code.

Alternatives considered:
- Add Azure-specific handling in existing message or UI pipelines. Rejected because it would recreate cross-cutting provider branching.

### 3. Support explicit capability gating for Azure OpenAI

The Azure OpenAI adapter should declare support or non-support for:
- streaming
- tool calls
- token estimation
- Anthropic-only session features

If a capability is missing or implemented as a fallback, diagnostics should surface that state clearly.

Why this approach:
- Azure OpenAI support will likely reach parity incrementally.
- Explicit capability reporting avoids silent regressions and unrealistic operator expectations.

Alternatives considered:
- Advertise parity by default and patch gaps after failures are reported. Rejected because enterprise operators need predictable rollout behavior.

### 4. Validate configuration before first request

Startup or first-use validation should verify Azure-specific configuration completeness and reject invalid combinations early.

Why this approach:
- Azure provider failures are often configuration mistakes rather than runtime inference bugs.
- Early validation shortens the feedback loop for enterprise deployment teams.

Alternatives considered:
- Let the first request fail naturally. Rejected because provider misconfiguration becomes harder to diagnose and creates noisy runtime failures.

## Risks / Trade-offs

- [Risk] Azure OpenAI tool-call semantics may not map cleanly to current shared tool behavior. -> Mitigation: gate tool support explicitly and normalize only supported patterns in phase one.
- [Risk] Deployment-based naming can confuse users expecting `--model` to work the same as Claude providers. -> Mitigation: document deployment-aware resolution and surface active deployment details in diagnostics.
- [Risk] Token estimation may not be identical to Anthropic-compatible paths. -> Mitigation: support explicit fallback behavior and label unsupported precision where necessary.
- [Risk] Azure identity integration could add environment-specific complexity. -> Mitigation: support a minimal API-key path first and isolate identity wiring to the Azure adapter configuration layer.

## Migration Plan

1. Implement Azure OpenAI configuration parsing and validation in the provider configuration layer.
2. Add the Azure OpenAI provider adapter behind the normalized provider interface.
3. Translate Azure OpenAI streaming and tool-call responses into shared internal events.
4. Add provider diagnostics and capability reporting for Azure OpenAI.
5. Validate success, misconfiguration, auth failure, and unsupported-feature flows.

Rollback strategy:
- Keep Azure OpenAI isolated behind provider selection so rollback means disabling that provider path without affecting Anthropic-compatible providers.
- Avoid mixing Azure-specific behavior into generic REPL logic so rollback remains adapter-scoped.

## Open Questions

- Should phase one support Azure AD authentication immediately, or should API-key auth ship first?
- Should `--model` continue to accept friendly aliases for Azure OpenAI, or should deployment names be required explicitly?
- Do enterprise requirements expect structured output and tool calling on day one, or is text-plus-streaming sufficient for the first rollout?
