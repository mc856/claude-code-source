## ADDED Requirements

### Requirement: Provider selection follows explicit precedence
The system SHALL resolve the active provider using a documented precedence order across CLI flags, settings, environment variables, and compatibility fallbacks.

#### Scenario: Resolve provider with multiple configuration sources
- **WHEN** provider-related configuration is present in more than one supported source
- **THEN** the system SHALL choose the active provider according to the documented precedence order
- **AND** it SHALL not leave provider selection implicit

### Requirement: Provider selection resolves exactly one active provider
The system SHALL determine exactly one active provider before request execution begins.

#### Scenario: Conflicting provider selections are present
- **WHEN** configuration sources request incompatible providers at the same time
- **THEN** the system SHALL resolve the conflict deterministically or fail with a clear configuration error

### Requirement: Model resolution is provider-aware
The system SHALL resolve the runtime model target after provider selection using provider-specific model or deployment rules.

#### Scenario: Resolve a provider-aware model target
- **WHEN** a runtime model target is configured
- **THEN** the system SHALL interpret it according to the selected provider's model-resolution rules
- **AND** it SHALL not assume a single provider-neutral model naming scheme

### Requirement: Incompatible provider and model combinations fail early
The system SHALL reject incompatible provider and model combinations before inference is attempted.

#### Scenario: Model target does not match selected provider
- **WHEN** the selected provider cannot use the requested model or deployment target
- **THEN** the system SHALL fail with a clear configuration error before sending a request
