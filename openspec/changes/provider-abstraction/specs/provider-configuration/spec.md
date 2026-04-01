## ADDED Requirements

### Requirement: Provider selection is configurable
The system SHALL allow runtime selection of Claude, OpenAI, and Azure OpenAI providers through documented configuration inputs.

#### Scenario: Resolve provider from runtime configuration
- **WHEN** the application starts with provider-related CLI flags, settings, or environment variables
- **THEN** it SHALL resolve a single active provider using a documented precedence order

### Requirement: Provider-specific credentials are validated before first request
The system SHALL validate that required credentials and endpoint settings are present for the selected provider before attempting the first model request.

#### Scenario: Azure OpenAI configuration is incomplete
- **WHEN** the selected provider is Azure OpenAI and required endpoint, deployment, API version, or credential inputs are missing
- **THEN** the system SHALL fail configuration validation before sending a model request

#### Scenario: OpenAI configuration is incomplete
- **WHEN** the selected provider is OpenAI and required model or credential inputs are missing
- **THEN** the system SHALL fail configuration validation before sending a model request

### Requirement: Model resolution is provider-aware
The system SHALL resolve model identifiers and aliases in a provider-aware manner so the same runtime can support provider-specific model naming without ambiguous behavior.

#### Scenario: Resolve a provider-specific model identifier
- **WHEN** a model is configured for the selected provider
- **THEN** the system SHALL resolve that model according to the selected provider's naming and alias rules
- **AND** it SHALL not assume Anthropic model naming for OpenAI-compatible providers

### Requirement: Provider diagnostics are visible to operators
The system SHALL expose the active provider, relevant endpoint context, and capability limitations through startup or status diagnostics.

#### Scenario: Inspect active provider status
- **WHEN** an operator reviews provider-related diagnostics
- **THEN** the system SHALL show which provider is active
- **AND** it SHALL surface relevant configuration or capability limitations that affect runtime behavior
