## 1. Configuration

- [x] 1.1 Define the Azure OpenAI configuration inputs required by the provider abstraction.
- [x] 1.2 Implement startup or first-use validation for Azure endpoint, deployment, API version, and credentials.
- [x] 1.3 Add Azure OpenAI provider diagnostics to status or startup reporting.

## 2. Adapter Implementation

- [x] 2.1 Implement the Azure OpenAI provider adapter on top of the normalized provider interface.
- [x] 2.2 Add Azure-specific request construction for deployment-aware inference execution.
- [x] 2.3 Normalize Azure OpenAI response payloads into the shared internal provider result format.

## 3. Streaming And Tools

- [x] 3.1 Implement Azure OpenAI streaming translation into the shared internal event model.
- [x] 3.2 Implement Azure OpenAI tool-call normalization or explicit capability gating where unsupported.
- [x] 3.3 Add fallback behavior for unsupported Azure OpenAI capabilities without leaking provider-specific failures into higher-level orchestration.

## 4. Validation

- [x] 4.1 Validate successful Azure OpenAI text generation and streaming flows.
- [x] 4.2 Validate Azure misconfiguration and authentication failure flows.
- [x] 4.3 Validate capability reporting for unsupported or limited Azure OpenAI features.
