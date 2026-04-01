## ADDED Requirements

### Requirement: Azure OpenAI provider executes inference requests
The system SHALL support Azure OpenAI as a selectable provider for the main inference path through the shared provider abstraction.

#### Scenario: Execute a request with Azure OpenAI selected
- **WHEN** the active provider is Azure OpenAI
- **THEN** the system SHALL execute the request through the Azure OpenAI provider adapter
- **AND** it SHALL return normalized provider results to higher-level orchestration

### Requirement: Azure OpenAI streaming is normalized
The system SHALL translate Azure OpenAI streaming responses into the shared internal provider event format.

#### Scenario: Stream an Azure OpenAI response
- **WHEN** Azure OpenAI returns incremental streaming data
- **THEN** the Azure OpenAI adapter SHALL convert that data into the shared internal event model before it reaches transcript or UI consumers

### Requirement: Azure OpenAI tool calls are normalized
The system SHALL normalize Azure OpenAI tool-call payloads into the shared internal tool-call format when tool calling is enabled for the selected deployment.

#### Scenario: Azure OpenAI emits a tool call
- **WHEN** Azure OpenAI returns a tool-call payload during inference
- **THEN** the adapter SHALL translate the payload into the shared internal tool-call representation used by the application

#### Scenario: Azure OpenAI deployment does not support tool calling
- **WHEN** the selected Azure OpenAI deployment or runtime path does not support tool calling
- **THEN** the system SHALL report that limitation through provider capabilities instead of assuming support

### Requirement: Azure OpenAI failures are mapped to shared provider errors
The system SHALL map Azure OpenAI-specific failures into the shared provider error model used by diagnostics and user-facing error handling.

#### Scenario: Azure OpenAI request fails
- **WHEN** an Azure OpenAI request fails because of authentication, configuration, quota, or protocol issues
- **THEN** the system SHALL convert the failure into a shared provider error category before surfacing it upstream
