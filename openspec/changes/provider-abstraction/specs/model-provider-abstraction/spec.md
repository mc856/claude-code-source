## ADDED Requirements

### Requirement: Main inference path uses a provider adapter
The system SHALL route the main model invocation path through a provider adapter interface instead of directly coupling higher-level orchestration to Anthropic SDK request and response types.

#### Scenario: Execute a request through the selected provider
- **WHEN** the CLI sends a prompt to the active model provider
- **THEN** the request SHALL be executed through a provider adapter selected from runtime configuration
- **AND** higher-level orchestration SHALL consume normalized request results rather than provider-native SDK types

### Requirement: Provider adapters normalize streaming and tool events
The system SHALL normalize provider-specific streaming events and tool-call payloads into a shared internal format consumed by transcript, tool orchestration, and UI layers.

#### Scenario: Stream a provider-specific response
- **WHEN** a provider returns streaming events for text, thinking, or tool invocation
- **THEN** the adapter SHALL translate those events into the shared internal event model before they reach higher-level consumers

#### Scenario: Handle provider-specific tool-call payloads
- **WHEN** a provider encodes tool calls or tool results using provider-specific fields
- **THEN** the adapter SHALL translate them into the shared internal tool-call format used by the application

### Requirement: Provider capabilities are explicit
The system SHALL expose provider capabilities so higher-level features can determine whether a selected provider supports streaming, tool calls, token estimation, or Anthropic-specific session features.

#### Scenario: Provider lacks a capability
- **WHEN** the active provider does not support a feature required by a workflow
- **THEN** the system SHALL detect that through declared provider capabilities
- **AND** it SHALL avoid assuming feature parity implicitly

### Requirement: Provider errors are normalized
The system SHALL map provider-specific request failures into a shared error model used by diagnostics and user-facing failure handling.

#### Scenario: Request fails at the provider layer
- **WHEN** a provider returns an authentication, configuration, quota, or protocol error
- **THEN** the adapter SHALL convert the failure into a shared error category and message structure before surfacing it upstream
