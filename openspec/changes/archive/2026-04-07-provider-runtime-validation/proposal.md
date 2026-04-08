## Why

The restored source runtime now works for the normal launcher path, but provider work still lacks a bounded validation contract on that restored runtime. Without an explicit provider/runtime gate, future changes can silently regress provider selection, startup diagnostics, or credential handling while the generic runtime gate continues to pass.

## What Changes

- Define a provider/runtime validation phase that runs on the restored source entry path rather than on the prebuilt bundle or on scanner output alone.
- Establish a bounded validation matrix for `claude`, `openai`, and `azure-openai` covering provider selection, model compatibility, startup diagnostics, and expected auth boundaries.
- Add repeatable validation entrypoints so maintainers can verify provider configuration behavior without depending on ad hoc manual command sequences.
- Preserve existing scope boundaries: Anthropic-only OAuth, bridge, and remote-session features remain provider-specific and are not broadened into generic provider requirements.

## Capabilities

### New Capabilities
- `provider-runtime-validation`: Defines the minimum provider-specific validation matrix, diagnostics expectations, and regression boundary for the restored source runtime.

### Modified Capabilities

## Impact

- Affects provider startup validation and diagnostics under `src/services/providers/` and bootstrap model-selection guards under `src/bootstrap/state.ts`.
- Affects validation scripts and test coverage used to verify the restored runtime after provider-related changes.
- Affects future provider follow-up work by making runtime validation explicit instead of relying on informal local checks.