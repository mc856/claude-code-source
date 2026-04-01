## Why

After introducing a provider abstraction and an Azure OpenAI adapter, the product still needs a coherent operator-facing way to select providers, resolve models, and understand capability limits. Enterprise rollouts will fail in practice if provider choice, credential precedence, and diagnostics remain implicit or fragmented across environment variables and legacy Claude-oriented messaging.

## What Changes

- Define a consistent provider selection flow across CLI flags, settings, and environment variables.
- Add provider-aware model selection and alias resolution behavior for Claude, OpenAI, and Azure OpenAI.
- Surface active provider, resolved model target, credential source state, and unsupported capabilities through status and startup diagnostics.
- Improve user-facing errors for provider misconfiguration, incompatible model selection, and unsupported features.
- Preserve backward compatibility where possible while steering users toward clearer provider configuration patterns.

## Capabilities

### New Capabilities
- `provider-selection`: Runtime provider selection with explicit precedence and compatibility rules across configuration sources.
- `provider-diagnostics`: Operator-visible diagnostics and user-facing errors for active provider, model resolution, credential state, and unsupported capabilities.

### Modified Capabilities

## Impact

- Affects CLI argument handling, settings resolution, environment-variable precedence, and startup validation flows.
- Changes user-visible status output and diagnostics around provider and model configuration.
- Requires provider-aware model alias handling and clearer error messages across the inference startup path.
- Reduces ambiguity for enterprise deployments that need to switch between Claude, OpenAI, and Azure OpenAI backends.
