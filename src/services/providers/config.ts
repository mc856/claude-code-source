/**
 * Provider configuration resolution and validation.
 *
 * # Provider selection precedence (highest → lowest):
 *
 *   1. Environment variable CLAUDE_CODE_PROVIDER=<provider>
 *      Accepts: "claude", "openai", "azure-openai"
 *
 *   2. Legacy Anthropic-compatible env vars (still honoured for backwards compat):
 *      CLAUDE_CODE_USE_BEDROCK=1   → claude  (Bedrock sub-path, handled inside adapter)
 *      CLAUDE_CODE_USE_VERTEX=1    → claude  (Vertex sub-path, handled inside adapter)
 *      CLAUDE_CODE_USE_FOUNDRY=1   → claude  (Foundry sub-path — Anthropic SDK, NOT Azure OpenAI)
 *
 *   3. Default: claude
 *
 * # OpenAI-specific env vars:
 *   OPENAI_API_KEY            – required when provider=openai
 *   OPENAI_BASE_URL           – optional base URL override (proxy/compatible endpoint)
 *   OPENAI_MODEL              – model name, e.g. "gpt-4o"
 *   OPENAI_DISABLE_TOOLS      – optional; disable function/tool calling when set
 *
 * # Azure OpenAI-specific env vars:
 *   AZURE_OPENAI_ENDPOINT     – required, e.g. https://my-resource.openai.azure.com
 *   AZURE_OPENAI_DEPLOYMENT   – required, deployment name
 *   AZURE_OPENAI_API_VERSION  – required, e.g. "2024-02-01"
 *   AZURE_OPENAI_API_KEY      – optional; when absent, DefaultAzureCredential is used
 *   AZURE_OPENAI_DISABLE_TOOLS – optional; disable function/tool calling when set
 */

import { isEnvTruthy } from '../../utils/envUtils.js'
import type {
  AzureOpenAIProviderConfig,
  ClaudeProviderConfig,
  ModelProvider,
  OpenAIProviderConfig,
  ProviderConfig,
  ProviderValidationResult,
} from './types.js'

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** Read the raw provider string from env or return undefined. */
function readProviderEnv(): ModelProvider | undefined {
  const raw = process.env.CLAUDE_CODE_PROVIDER?.trim().toLowerCase()
  if (!raw) return undefined
  if (raw === 'claude' || raw === 'openai' || raw === 'azure-openai') {
    return raw as ModelProvider
  }
  // Unknown value — warn and fall through to default
  process.stderr.write(
    `[provider] CLAUDE_CODE_PROVIDER="${process.env.CLAUDE_CODE_PROVIDER}" is not a recognised provider. ` +
      `Valid values: claude, openai, azure-openai. Falling back to "claude".\n`,
  )
  return undefined
}

/**
 * Resolve and return the active ProviderConfig.
 *
 * This is called once at query startup. The result is passed to
 * `getProviderAdapter()` which constructs the appropriate adapter instance.
 */
export function getProviderConfig(): ProviderConfig {
  const provider = readProviderEnv()

  // Explicit CLAUDE_CODE_PROVIDER takes priority over everything else.
  if (provider === 'openai') return buildOpenAIConfig()
  if (provider === 'azure-openai') return buildAzureOpenAIConfig()

  // Legacy env vars all map to the claude adapter (sub-path resolved internally).
  // The explicit "claude" value also lands here.
  return buildClaudeConfig()
}

// ---------------------------------------------------------------------------
// Config builders
// ---------------------------------------------------------------------------

function buildClaudeConfig(): ClaudeProviderConfig {
  return { provider: 'claude' }
}

function buildOpenAIConfig(): OpenAIProviderConfig {
  return {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
    disableTools: isEnvTruthy(process.env.OPENAI_DISABLE_TOOLS),
  }
}

function buildAzureOpenAIConfig(): AzureOpenAIProviderConfig {
  return {
    provider: 'azure-openai',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? '',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-01',
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    disableTools: isEnvTruthy(process.env.AZURE_OPENAI_DISABLE_TOOLS),
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that all required credentials and endpoint settings are present
 * for the given provider config.
 *
 * Called at startup before the first model request so missing config is
 * reported immediately rather than inside the inference path.
 */
export function validateProviderConfig(
  config: ProviderConfig,
): ProviderValidationResult {
  switch (config.provider) {
    case 'claude':
      return validateClaude()
    case 'openai':
      return validateOpenAI(config)
    case 'azure-openai':
      return validateAzureOpenAI(config)
  }
}

function validateClaude(): ProviderValidationResult {
  // Existing Anthropic-compatible providers perform their own auth checks
  // inside getAnthropicClient(). No additional pre-flight validation here.
  return { valid: true }
}

function validateOpenAI(config: OpenAIProviderConfig): ProviderValidationResult {
  const errors: string[] = []

  if (!config.apiKey) {
    errors.push(
      'OPENAI_API_KEY is required when CLAUDE_CODE_PROVIDER=openai. ' +
        'Set it to your OpenAI API key.',
    )
  }
  if (!config.model) {
    errors.push(
      'OPENAI_MODEL must be set to a fully-qualified model name (e.g. "gpt-4o") ' +
        'when CLAUDE_CODE_PROVIDER=openai.',
    )
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}

function validateAzureOpenAI(
  config: AzureOpenAIProviderConfig,
): ProviderValidationResult {
  const errors: string[] = []

  if (!config.endpoint) {
    errors.push(
      'AZURE_OPENAI_ENDPOINT is required when CLAUDE_CODE_PROVIDER=azure-openai. ' +
        'Format: https://<resource-name>.openai.azure.com',
    )
  } else {
    try {
      const url = new URL(config.endpoint)
      if (!url.hostname.includes('openai.azure.com') &&
          !url.hostname.includes('cognitive.microsoft.com') &&
          !url.hostname.includes('api.cognitive.microsoft.com')) {
        // Allow custom endpoints (proxies / sovereign clouds) — only warn.
        process.stderr.write(
          `[provider] AZURE_OPENAI_ENDPOINT "${config.endpoint}" does not look like a standard ` +
            'Azure OpenAI endpoint. Proceeding, but verify the URL is correct.\n',
        )
      }
    } catch {
      errors.push(`AZURE_OPENAI_ENDPOINT "${config.endpoint}" is not a valid URL.`)
    }
  }

  if (!config.deployment) {
    errors.push(
      'AZURE_OPENAI_DEPLOYMENT is required when CLAUDE_CODE_PROVIDER=azure-openai. ' +
        'Set it to your Azure OpenAI deployment name.',
    )
  }

  if (!config.apiVersion) {
    errors.push(
      'AZURE_OPENAI_API_VERSION is required when CLAUDE_CODE_PROVIDER=azure-openai. ' +
        'Example: "2024-02-01".',
    )
  }

  // API key is optional — absence triggers DefaultAzureCredential (Entra ID).
  // We don't validate that DefaultAzureCredential will succeed here; that
  // surface is covered at request time.

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}

// ---------------------------------------------------------------------------
// Legacy detection helpers
// ---------------------------------------------------------------------------

/**
 * True when the active provider is any Anthropic-compatible path
 * (firstParty, Bedrock, Vertex, or Foundry).
 */
export function isAnthropicCompatibleProvider(): boolean {
  const config = getProviderConfig()
  return config.provider === 'claude'
}

/**
 * True when the active provider supports Anthropic-only session features
 * (remote-control, bridge, OAuth).
 */
export function isAnthropicOnlyFeaturesAvailable(): boolean {
  return isAnthropicCompatibleProvider()
}

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------
export { isEnvTruthy }
