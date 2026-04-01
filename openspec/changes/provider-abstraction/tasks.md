## 1. Provider Boundary

- [ ] 1.1 Inventory the current Anthropic SDK touchpoints in the main inference path and define the normalized provider adapter interface.
- [ ] 1.2 Introduce shared normalized request, streaming, tool-call, token-estimation, capability, and error types for provider adapters.
- [ ] 1.3 Refactor the primary request execution path to consume the provider adapter interface instead of direct Anthropic SDK types.

## 2. Anthropic Compatibility Migration

- [ ] 2.1 Wrap the existing first-party, Bedrock, Vertex, and Foundry paths behind the new provider adapter boundary.
- [ ] 2.2 Move provider-specific streaming and tool-call translation into adapter implementations while preserving current Anthropic-compatible behavior.
- [ ] 2.3 Add focused validation for success and failure paths across existing Anthropic-compatible providers after the adapter refactor.

## 3. Provider Configuration

- [ ] 3.1 Define documented provider selection precedence across CLI flags, settings, and environment variables.
- [ ] 3.2 Implement provider-aware credential and endpoint validation for Claude, OpenAI, and Azure OpenAI selections.
- [ ] 3.3 Update status or startup diagnostics to report the active provider, endpoint context, and unsupported capabilities.

## 4. OpenAI-Compatible Providers

- [ ] 4.1 Implement an OpenAI provider adapter for the normalized inference interface.
- [ ] 4.2 Implement an Azure OpenAI provider adapter, including provider-specific endpoint, deployment, and API-version handling.
- [ ] 4.3 Validate streaming, tool-call, token-estimation fallback behavior, and error mapping for OpenAI-compatible providers.

## 5. Scope Guards

- [ ] 5.1 Preserve Anthropic-only OAuth, bridge, session-ingress, and remote-control flows outside the generic provider abstraction.
- [ ] 5.2 Add explicit capability gating so Anthropic-only features are not presented as generic provider behavior.
