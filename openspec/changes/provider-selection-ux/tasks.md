## 1. Provider Resolution

- [x] 1.1 Define the runtime precedence order for provider selection across CLI flags, settings, environment variables, and compatibility fallbacks.
- [x] 1.2 Refactor startup configuration resolution so exactly one active provider is chosen before model resolution.
- [x] 1.3 Add conflict handling for incompatible provider selections across multiple configuration sources.

## 2. Model Resolution

- [x] 2.1 Refactor model target resolution to run after provider selection using provider-aware rules.
- [x] 2.2 Add validation for incompatible provider and model or deployment combinations.
- [x] 2.3 Preserve compatible legacy aliases and compatibility shims where they remain unambiguous.

## 3. Diagnostics

- [x] 3.1 Update status and startup diagnostics to show the active provider and resolved model or deployment target.
- [x] 3.2 Add capability-limit diagnostics for unsupported provider features.
- [x] 3.3 Add provider-specific credential-state diagnostics without exposing secrets.

## 4. Errors And Validation

- [x] 4.1 Improve user-facing provider misconfiguration errors for Claude, OpenAI, and Azure OpenAI.
- [x] 4.2 Add validation coverage for precedence conflicts, invalid provider-model combinations, and missing credentials.
- [x] 4.3 Verify that legacy Claude-oriented configuration paths continue to behave predictably during migration.
