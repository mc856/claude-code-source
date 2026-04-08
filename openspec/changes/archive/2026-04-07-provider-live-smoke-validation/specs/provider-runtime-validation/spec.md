## ADDED Requirements

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