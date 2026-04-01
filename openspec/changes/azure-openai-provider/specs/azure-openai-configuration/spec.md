## ADDED Requirements

### Requirement: Azure OpenAI configuration is explicit
The system SHALL support explicit Azure OpenAI configuration inputs for endpoint, deployment, API version, and credential source.

#### Scenario: Resolve Azure OpenAI configuration
- **WHEN** the active provider is Azure OpenAI
- **THEN** the system SHALL resolve Azure-specific configuration fields before request execution

### Requirement: Azure OpenAI configuration is validated before first request
The system SHALL reject incomplete or inconsistent Azure OpenAI configuration before the first model request is sent.

#### Scenario: Missing Azure endpoint
- **WHEN** Azure OpenAI is selected and the configured endpoint is missing
- **THEN** the system SHALL fail provider validation before sending a model request

#### Scenario: Missing Azure deployment
- **WHEN** Azure OpenAI is selected and the configured deployment name is missing
- **THEN** the system SHALL fail provider validation before sending a model request

#### Scenario: Missing Azure API version
- **WHEN** Azure OpenAI is selected and the configured API version is missing
- **THEN** the system SHALL fail provider validation before sending a model request

### Requirement: Azure OpenAI model resolution is deployment-aware
The system SHALL resolve Azure OpenAI execution targets in a deployment-aware manner rather than assuming Anthropic-style model naming.

#### Scenario: Use a configured Azure deployment
- **WHEN** the runtime resolves the model target for Azure OpenAI
- **THEN** it SHALL use the configured Azure deployment semantics for request routing
- **AND** it SHALL not require Anthropic model naming to be present

### Requirement: Azure OpenAI diagnostics are visible
The system SHALL expose Azure OpenAI-specific provider diagnostics for operators.

#### Scenario: Inspect Azure OpenAI provider status
- **WHEN** an operator inspects provider-related diagnostics while Azure OpenAI is active
- **THEN** the system SHALL show that Azure OpenAI is the selected provider
- **AND** it SHALL expose relevant endpoint, deployment, or capability context needed for troubleshooting
