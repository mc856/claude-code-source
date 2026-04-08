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