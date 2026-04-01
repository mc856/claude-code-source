/**
 * Provider configuration resolution and validation.
 *
 * # Provider selection precedence (highest -> lowest):
 *
 *   1. --provider CLI flag (parsed from process.argv)
 *      e.g. --provider openai
 *
 *   2. Settings key provider
 *      e.g. { "provider": "openai" } in settings.json
 *
 *   3. Environment variable CLAUDE_CODE_PROVIDER=<provider>
 *      Accepts: "claude", "openai", "azure-openai"
 *
 *   4. Legacy Anthropic-compatible env vars (still honoured for backwards compat):
 *      CLAUDE_CODE_USE_BEDROCK=1   -> claude  (Bedrock sub-path, handled inside adapter)
 *      CLAUDE_CODE_USE_VERTEX=1    -> claude  (Vertex sub-path, handled inside adapter)
 *      CLAUDE_CODE_USE_FOUNDRY=1   -> claude  (Foundry sub-path - Anthropic SDK, NOT Azure OpenAI)
 *
 *   5. Default: claude
 *
 * When multiple explicit sources specify conflicting providers, the
 * highest-priority source wins and a warning is emitted to stderr.
 *
 * # OpenAI-specific env vars:
 *   OPENAI_API_KEY             - required when provider=openai
 *   OPENAI_BASE_URL            - optional base URL override (proxy/compatible endpoint)
 *   OPENAI_MODEL               - model name, e.g. "gpt-4o"
 *   OPENAI_DISABLE_TOOLS       - optional; disable function/tool calling when set
 *
 * # Azure OpenAI-specific env vars:
 *   AZURE_OPENAI_ENDPOINT      - required, e.g. https://my-resource.openai.azure.com
 *   AZURE_OPENAI_DEPLOYMENT    - required, deployment name
 *   AZURE_OPENAI_API_VERSION   - required, e.g. "2024-02-01"
 *   AZURE_OPENAI_API_KEY       - optional; when absent, DefaultAzureCredential is used
 *   AZURE_OPENAI_DISABLE_TOOLS - optional; disable function/tool calling when set
 */

import { isEnvTruthy } from '../../utils/envUtils.js'
import { eagerParseCliFlag } from '../../utils/cliArgs.js'
import { getSettings_DEPRECATED } from '../../utils/settings/settings.js'
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

function parseProviderValue(
  raw: string | undefined,
  source: string,
): ModelProvider | undefined {
  if (!raw) return undefined

  const normalized = raw.trim().toLowerCase()
  if (
    normalized === 'claude' ||
    normalized === 'openai' ||
    normalized === 'azure-openai'
  ) {
    return normalized as ModelProvider
  }

  process.stderr.write(
    `[provider] ${source}="${raw}" is not a recognised provider. ` +
      'Valid values: claude, openai, azure-openai. Falling back to next source.\n',
  )
  return undefined
}

/** Read the --provider CLI flag (parsed eagerly from process.argv). */
function readProviderCliFlag(): ModelProvider | undefined {
  return parseProviderValue(eagerParseCliFlag('--provider'), '--provider flag')
}

function readProviderEnv(): ModelProvider | undefined {
  return parseProviderValue(
    process.env.CLAUDE_CODE_PROVIDER,
    'CLAUDE_CODE_PROVIDER',
  )
}

function readProviderSetting(): ModelProvider | undefined {
  try {
    const settings = getSettings_DEPRECATED()
    if (!settings || typeof settings.provider !== 'string') {
      return undefined
    }
    return parseProviderValue(settings.provider, 'settings.provider')
  } catch {
    // Settings may not be available during early startup; fall through.
    return undefined
  }
}

/**
 * Emit a conflict warning when two explicit provider sources disagree.
 * The winning (higher-priority) source is used; the losing source is reported.
 */
function warnProviderConflict(
  winner: ModelProvider,
  winnerSource: string,
  loser: ModelProvider,
  loserSource: string,
): void {
  process.stderr.write(
    `[provider] Conflict: ${winnerSource} specifies "${winner}" but ` +
      `${loserSource} specifies "${loser}". ` +
      `Using "${winner}" (${winnerSource} takes precedence).\n`,
  )
}

/**
 * Resolve exactly one active provider from all configuration sources in
 * documented precedence order: CLI flag > settings > env var > legacy > default.
 */
function resolveActiveProvider(): ModelProvider {
  const cliProvider = readProviderCliFlag()
  const settingsProvider = readProviderSetting()
  const envProvider = readProviderEnv()

  // Warn about conflicts between explicit sources before selecting the winner.
  if (cliProvider && settingsProvider && settingsProvider !== cliProvider) {
    warnProviderConflict(cliProvider, '--provider flag', settingsProvider, 'settings.provider')
  }
  if (cliProvider && envProvider && envProvider !== cliProvider) {
    warnProviderConflict(cliProvider, '--provider flag', envProvider, 'CLAUDE_CODE_PROVIDER')
  }
  if (
    !cliProvider &&
    settingsProvider &&
    envProvider &&
    settingsProvider !== envProvider
  ) {
    warnProviderConflict(
      settingsProvider,
      'settings.provider',
      envProvider,
      'CLAUDE_CODE_PROVIDER',
    )
  }

  // Select winner by precedence.
  return (
    cliProvider ??
    settingsProvider ??
    envProvider ??
    'claude' // legacy env vars and default all map to claude
  )
}

/**
 * Resolve and return the active ProviderConfig.
 *
 * Exactly one provider is chosen using the documented precedence order before
 * model resolution begins. The result determines which adapter is instantiated.
 */
export function getProviderConfig(): ProviderConfig {
  const provider = resolveActiveProvider()

  if (provider === 'openai') return buildOpenAIConfig()
  if (provider === 'azure-openai') return buildAzureOpenAIConfig()

  // 'claude' — includes all Anthropic-compatible sub-paths (Bedrock, Vertex, Foundry).
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
  // Bedrock, Vertex, and Foundry sub-paths use their own credential mechanisms.
  // For first-party Anthropic API, check that an API key is available when
  // not using OAuth or a session-based auth path.
  const isThirdParty =
    isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK) ||
    isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX) ||
    isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)

  if (!isThirdParty && !process.env.ANTHROPIC_API_KEY) {
    // OAuth and keychain auth may still succeed; this is a soft warning, not a
    // hard failure. The underlying Anthropic SDK will surface auth errors at
    // request time if no valid credential can be found.
    // Return valid here and let the SDK handle auth — do not block startup for
    // users who authenticate via OAuth without an explicit API key.
  }

  return { valid: true }
}

function validateOpenAI(config: OpenAIProviderConfig): ProviderValidationResult {
  const errors: string[] = []

  if (!config.apiKey) {
    errors.push(
      'OpenAI provider requires an API key. ' +
        'Set OPENAI_API_KEY to your OpenAI API key.',
    )
  }
  if (!config.model) {
    errors.push(
      'OpenAI provider requires a model name. ' +
        'Set OPENAI_MODEL to a fully-qualified OpenAI model name (e.g. "gpt-4o").',
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
      'Azure OpenAI provider requires an endpoint URL. ' +
        'Set AZURE_OPENAI_ENDPOINT to your resource URL ' +
        '(e.g. https://<resource-name>.openai.azure.com).',
    )
  } else {
    try {
      const url = new URL(config.endpoint)
      if (
        !url.hostname.includes('openai.azure.com') &&
        !url.hostname.includes('cognitive.microsoft.com') &&
        !url.hostname.includes('api.cognitive.microsoft.com')
      ) {
        process.stderr.write(
          `[provider] AZURE_OPENAI_ENDPOINT "${config.endpoint}" does not look like a standard ` +
            'Azure OpenAI endpoint. Proceeding, but verify the URL is correct.\n',
        )
      }
    } catch {
      errors.push(
        `Azure OpenAI endpoint "${config.endpoint}" is not a valid URL. ` +
          'Set AZURE_OPENAI_ENDPOINT to a valid https:// URL.',
      )
    }
  }

  if (!config.deployment) {
    errors.push(
      'Azure OpenAI provider requires a deployment name. ' +
        'Set AZURE_OPENAI_DEPLOYMENT to your deployment name in the Azure resource.',
    )
  }

  if (!config.apiVersion) {
    errors.push(
      'Azure OpenAI provider requires an API version. ' +
        'Set AZURE_OPENAI_API_VERSION (e.g. "2024-02-01").',
    )
  }

  // API key is optional — absence triggers DefaultAzureCredential (Entra ID).
  // No error for missing key; the adapter handles credential fallback.

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}

// ---------------------------------------------------------------------------
// Legacy detection helpers
// ---------------------------------------------------------------------------

export function isAnthropicCompatibleProvider(): boolean {
  const config = getProviderConfig()
  return config.provider === 'claude'
}

export function isAnthropicOnlyFeaturesAvailable(): boolean {
  return isAnthropicCompatibleProvider()
}

export { isEnvTruthy }
