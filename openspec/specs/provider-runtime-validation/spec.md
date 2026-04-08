## ADDED Requirements

### Requirement: Restored runtime provider validation matrix
The project SHALL maintain a bounded provider validation matrix for the restored source runtime that covers `claude`, `openai`, and `azure-openai` startup behavior.

#### Scenario: Maintainer runs provider validation
- **WHEN** maintainers validate provider-related changes on the restored source runtime
- **THEN** they MUST execute repeatable checks that cover provider selection, resolved model context, and startup validation behavior for `claude`, `openai`, and `azure-openai`
- **AND** those checks MUST run against `bun run ./src/dev-entry.ts` or source-imported validation helpers rather than relying only on the prebuilt `cli.js`

### Requirement: Provider-specific auth and compatibility boundaries remain explicit
The project SHALL distinguish expected provider-specific auth and model-compatibility failures from restored-runtime regressions.

#### Scenario: Claude bare mode is validated
- **WHEN** maintainers validate the `claude` provider through a `--bare` source-runtime command without an explicit API key or helper-based credential configuration
- **THEN** an OAuth-disabled auth failure MUST be treated as an expected provider boundary
- **AND** it MUST NOT be recorded as a restored-source runtime failure

#### Scenario: OpenAI-compatible provider receives a Claude-specific model
- **WHEN** the active provider is `openai` or `azure-openai` and the runtime is configured with a Claude-specific model alias or model identifier
- **THEN** validation MUST report that incompatibility through provider validation output or tests
- **AND** the result MUST be treated as a provider/model compatibility failure rather than a generic startup stall

### Requirement: Startup diagnostics are regression-checked without live provider calls
The project SHALL provide repeatable validation that exercises provider diagnostics and configuration errors without requiring live network requests to each provider backend.

#### Scenario: Required provider configuration is missing
- **WHEN** a maintainer validates `openai` without `OPENAI_API_KEY` or validates `azure-openai` without its required endpoint or deployment configuration
- **THEN** the validation flow MUST fail with provider-specific configuration errors before any live request attempt

#### Scenario: Diagnostics snapshot is generated
- **WHEN** a maintainer validates a configured provider runtime locally
- **THEN** the validation flow MUST surface the active provider, resolved model target, and credential source or limitation context from the current diagnostics path

### Requirement: Opt-in live provider smoke validation
The project SHALL provide an explicit opt-in live provider smoke command that can execute real restored-runtime prompt checks against configured providers.

#### Scenario: Live smoke is not enabled
- **WHEN** a maintainer runs the live smoke command without the documented opt-in control enabled
- **THEN** the command MUST skip live provider execution
- **AND** it MUST exit successfully after reporting that live smoke was intentionally not run

#### Scenario: Live smoke is enabled for selected providers
- **WHEN** a maintainer enables live smoke and selects one or more providers with the required configuration present
- **THEN** the command MUST execute restored-runtime `-p` smoke checks for those providers
- **AND** it MUST report pass, fail, or skip results per provider rather than collapsing all outcomes into one opaque status

### Requirement: Live smoke skips remain explicit and bounded
The project SHALL distinguish an intentionally skipped live provider smoke run from both deterministic validation failures and real provider execution failures.

#### Scenario: Required live smoke configuration is absent
- **WHEN** a selected provider lacks the documented minimum configuration for a live smoke run
- **THEN** the command MUST report that provider as skipped with a configuration-specific reason
- **AND** the overall command MUST remain successful if no selected provider actually attempted execution

#### Scenario: Selected live provider execution fails
- **WHEN** a selected and configured provider attempts a live smoke prompt and the restored runtime does not return the expected successful prompt result
- **THEN** the command MUST mark that provider as failed
- **AND** the overall command MUST exit nonzero