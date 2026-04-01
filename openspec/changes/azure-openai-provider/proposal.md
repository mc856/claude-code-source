## Why

Enterprise deployments need a supported Azure OpenAI path, but the repository currently centers its main inference behavior around Claude-oriented request and model assumptions. After establishing a provider abstraction, Azure OpenAI needs its own scoped change so deployment, authentication, model resolution, and capability behavior can be implemented and validated explicitly.

## What Changes

- Add an Azure OpenAI provider adapter on top of the new provider abstraction.
- Support Azure OpenAI-specific configuration, including endpoint, deployment name, API version, and authentication inputs.
- Normalize Azure OpenAI streaming and tool-call behavior into the shared internal provider event model.
- Add Azure OpenAI-specific diagnostics, validation, and operator-facing error messages.
- Define phase-one capability limits where Azure OpenAI behavior differs from Anthropic-backed providers.

## Capabilities

### New Capabilities
- `azure-openai-inference`: Azure OpenAI adapter for prompt execution, streaming, tool calls, and provider-specific error handling.
- `azure-openai-configuration`: Azure OpenAI endpoint, deployment, API-version, and credential configuration with startup validation and diagnostics.

### Modified Capabilities

## Impact

- Affects provider adapter implementation and provider selection flow in the main inference path.
- Adds Azure OpenAI-specific configuration parsing, credential validation, and status reporting.
- Introduces Azure OpenAI-specific streaming and tool-call normalization logic.
- Requires focused testing for compatibility gaps versus existing Anthropic-compatible providers.
