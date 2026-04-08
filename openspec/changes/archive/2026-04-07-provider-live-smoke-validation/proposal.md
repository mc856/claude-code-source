## Why

The restored runtime now has deterministic provider validation, but the current gate intentionally stops short of real provider-backed prompt execution. Teams that do have live credentials need an explicit, opt-in smoke path so they can verify end-to-end provider execution without turning secrets-dependent checks into a required default gate.

## What Changes

- Extend provider runtime validation with an optional live smoke layer for `claude`, `openai`, and `azure-openai`.
- Add an operator-invoked validation entrypoint that runs real `-p` prompt checks only when explicitly enabled.
- Define provider-selection and missing-config rules so the live smoke command can skip safely when credentials or endpoints are not configured.
- Preserve the default deterministic provider validation script as the required regression gate; live smoke remains additive and opt-in.

## Capabilities

### New Capabilities

### Modified Capabilities
- `provider-runtime-validation`: Extend provider validation to support an explicit opt-in live smoke layer while keeping secrets-dependent checks out of the default required gate.

## Impact

- Affects provider validation scripts under `scripts/` and provider validation helpers under `src/services/providers/`.
- Adds operator-facing validation behavior for environments with real provider credentials.
- Clarifies the boundary between required deterministic validation and optional end-to-end smoke coverage.