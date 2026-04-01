## ADDED Requirements

### Requirement: Provider runtime state is visible
The system SHALL expose the active provider and resolved runtime target through status or startup diagnostics.

#### Scenario: Inspect active provider diagnostics
- **WHEN** an operator checks provider-related diagnostics
- **THEN** the system SHALL show the active provider
- **AND** it SHALL show the resolved model or deployment target relevant to that provider

### Requirement: Capability limits are visible
The system SHALL surface unsupported or limited provider capabilities that affect current runtime behavior.

#### Scenario: Provider lacks a capability
- **WHEN** the active provider does not support a requested or relevant capability
- **THEN** the system SHALL report that limitation through operator-visible diagnostics or user-facing messaging

### Requirement: Credential state is diagnosable
The system SHALL show whether provider credentials are available, missing, or invalid without exposing secrets.

#### Scenario: Missing credentials for selected provider
- **WHEN** the selected provider lacks required credentials
- **THEN** the system SHALL show a provider-specific diagnostic or error that identifies the missing credential state without revealing sensitive values

### Requirement: Misconfiguration errors are provider-specific
The system SHALL present provider-specific configuration and compatibility errors in user-facing language.

#### Scenario: Provider configuration is invalid
- **WHEN** startup or first-use validation detects invalid provider configuration
- **THEN** the system SHALL return a provider-specific error that identifies the relevant provider and the class of configuration problem
