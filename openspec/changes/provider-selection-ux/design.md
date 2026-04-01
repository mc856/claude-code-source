## Context

The current repository already exposes provider behavior through a mixture of CLI flags, settings, and provider-specific environment variables, but the behavior is largely Claude-oriented and spread across multiple modules. As new providers are added, unclear precedence and inconsistent messaging create operational risk:

- users may not know which provider is actually active
- model aliases may resolve differently across providers
- a valid credential for one provider may be ignored while another provider is selected
- unsupported provider capabilities may only fail after a request is sent

This change focuses on the user-visible and operator-visible configuration surface built on top of the provider abstraction.

## Goals / Non-Goals

**Goals:**
- Define explicit provider selection precedence across CLI flags, settings, and environment variables.
- Make model resolution and alias behavior provider-aware and diagnosable.
- Expose the active provider, resolved model target, and relevant capability limits to operators.
- Improve misconfiguration and unsupported-feature errors so they fail clearly before or during startup.
- Preserve reasonable backward compatibility while encouraging a cleaner provider configuration model.

**Non-Goals:**
- Implementing the core provider abstraction itself.
- Implementing the Azure OpenAI adapter itself.
- Rewriting Anthropic-specific remote/session UX.
- Building an interactive setup wizard for provider configuration in this change.

## Decisions

### 1. Define a single provider-resolution precedence order

Provider resolution should follow one documented precedence order across:
- CLI flags
- settings
- environment variables
- legacy compatibility fallbacks

The application should resolve exactly one active provider before inference startup.

Why this approach:
- Enterprise users need deterministic behavior.
- It prevents hidden overrides from old environment variables or stale config files.

Alternatives considered:
- Leave precedence distributed across existing code paths. Rejected because the ambiguity gets worse as new providers are added.

### 2. Separate provider choice from model target resolution

Provider selection should happen first. Model resolution should happen second, using provider-aware rules.

Why this approach:
- The same literal model string can mean different things across providers.
- Azure OpenAI may require deployment-aware resolution, while Claude providers may rely on family aliases.

Alternatives considered:
- Keep a single global model resolution pass before provider selection. Rejected because it bakes in provider assumptions too early.

### 3. Show resolved runtime state in diagnostics

Status and startup diagnostics should show:
- active provider
- resolved model or deployment target
- relevant endpoint context
- credential source or missing credential state
- unsupported provider capabilities that affect current behavior

Why this approach:
- Operators need to verify runtime state quickly.
- It shortens the loop for support and deployment troubleshooting.

Alternatives considered:
- Only log provider details in debug mode. Rejected because basic operational clarity should not require deep debugging.

### 4. Fail early on incompatible provider and model combinations

If a chosen provider and requested model or deployment target are incompatible, the application should fail with a clear configuration error instead of attempting inference.

Why this approach:
- It prevents confusing downstream protocol or auth failures.
- It aligns with enterprise requirements for explicit deployment validation.

Alternatives considered:
- Attempt best-effort fallback model remapping. Rejected because silent remapping is hard to reason about and audit.

## Risks / Trade-offs

- [Risk] Tightening precedence rules could surface previously hidden configuration conflicts. -> Mitigation: keep compatibility fallbacks where possible and provide explicit diagnostics when conflicts are detected.
- [Risk] Provider-aware model resolution may expose legacy assumptions in tests and scripts. -> Mitigation: document the new behavior and preserve existing aliases where they remain unambiguous.
- [Risk] More visible diagnostics may require careful wording to avoid exposing sensitive configuration details. -> Mitigation: show endpoint and credential-source context without leaking secrets or tokens.
- [Risk] Backward compatibility with old Claude-oriented environment variables may prolong complexity. -> Mitigation: isolate legacy mapping in a compatibility layer and steer new configuration toward clearer provider names.

## Migration Plan

1. Define and document provider selection precedence.
2. Implement provider-first resolution followed by provider-aware model resolution.
3. Update status and startup diagnostics to show resolved provider runtime state.
4. Add explicit conflict and unsupported-feature errors for provider and model selection.
5. Preserve legacy compatibility shims where needed while directing new configuration toward the new flow.

Rollback strategy:
- Keep legacy provider resolution wiring isolated so the old path can be temporarily restored if precedence changes cause regressions.
- Avoid coupling this rollout to protocol adapter changes so rollback stays focused on configuration and diagnostics.

## Open Questions

- Should the user-facing provider name be `claude` or `anthropic` in flags and status output?
- Should provider selection support both old and new names indefinitely, or should one become deprecated after rollout?
- How much endpoint detail is safe and useful to show in default status output for enterprise operators?
