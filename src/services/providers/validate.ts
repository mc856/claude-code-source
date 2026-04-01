/**
 * Focused validation for provider adapter success and failure paths.
 *
 * For Anthropic-compatible providers (claude adapter), validation is light —
 * auth checks are already performed inside `getAnthropicClient()` and
 * the retry / error handling layer in `withRetry.ts`.
 *
 * For OpenAI-compatible providers, pre-flight validation is more important
 * because the adapter does not share the Anthropic SDK's built-in checks.
 *
 * This module is called once at startup (from bootstrap) to surface
 * configuration problems before the first model request.
 */

import { logForDebugging } from '../../utils/debug.js'
import { getProviderConfig, validateProviderConfig } from './config.js'
import type { ProviderConfig } from './types.js'

// ---------------------------------------------------------------------------
// Provider-model compatibility
// ---------------------------------------------------------------------------

/**
 * Model identifiers and aliases that are specific to the Claude / Anthropic
 * provider and are not valid on OpenAI-compatible backends.
 */
const CLAUDE_SPECIFIC_ALIASES = new Set([
  'sonnet', 'opus', 'haiku', 'best', 'opusplan',
  'sonnet[1m]', 'opus[1m]',
])

/**
 * Return true when the model string looks like a Claude-specific model
 * identifier (alias or full Anthropic model ID).
 */
function isClaudeSpecificModel(model: string): boolean {
  const normalized = model.toLowerCase().trim()
  return (
    CLAUDE_SPECIFIC_ALIASES.has(normalized) ||
    normalized.startsWith('claude-') ||
    // Cross-region Bedrock / Vertex prefixes
    normalized.startsWith('us.anthropic.') ||
    normalized.startsWith('eu.anthropic.') ||
    normalized.startsWith('ap.anthropic.')
  )
}

/**
 * Validate that the given model identifier is compatible with the active
 * provider.  Returns an array of error strings (empty when valid).
 *
 * This is separate from validateProviderConfig so it can be called after
 * model resolution is complete (e.g. once the --model flag has been parsed).
 */
export function validateProviderModelCombination(
  config: ProviderConfig,
  model: string,
): string[] {
  // Claude provider handles all Claude model identifiers and aliases.
  if (config.provider === 'claude') return []

  if (isClaudeSpecificModel(model)) {
    const providerLabel =
      config.provider === 'openai' ? 'OpenAI' : 'Azure OpenAI'
    return [
      `Model "${model}" looks like a Claude-specific model or alias and is ` +
        `not compatible with the ${providerLabel} provider. ` +
        `Set a ${providerLabel}-compatible model name instead ` +
        `(e.g. ${config.provider === 'openai' ? '"gpt-4o" via OPENAI_MODEL' : 'your deployment name via AZURE_OPENAI_DEPLOYMENT'}).`,
    ]
  }

  return []
}

// ---------------------------------------------------------------------------
// Startup validation
// ---------------------------------------------------------------------------

/**
 * Validate the active provider configuration and throw if required fields
 * are missing.  Call this during startup / bootstrap — not inside the query
 * hot path.
 *
 * For the "claude" provider this is a no-op (existing auth layers handle it).
 * For "openai" and "azure-openai" this surfaces missing credentials early.
 *
 * Pass `model` to also validate provider-model combination compatibility.
 */
export function assertProviderConfigValid(
  config?: ProviderConfig,
  model?: string,
): void {
  const resolved = config ?? getProviderConfig()
  const result = validateProviderConfig(resolved)

  const errors: string[] = result.valid ? [] : [...result.errors]

  // Check model compatibility when a specific model target is provided.
  if (model) {
    errors.push(...validateProviderModelCombination(resolved, model))
  }

  if (errors.length > 0) {
    const header = `Provider configuration error (provider: ${resolved.provider}):`
    const body = errors.map(e => `  • ${e}`).join('\n')
    throw new Error(`${header}\n${body}`)
  }

  logForDebugging(
    `[provider] Configuration valid for provider: ${resolved.provider}`,
  )
}

/**
 * Soft validation — returns error strings instead of throwing.
 * Suitable for diagnostic displays that should not crash startup.
 */
export function getProviderConfigErrors(config?: ProviderConfig): string[] {
  const resolved = config ?? getProviderConfig()
  const result = validateProviderConfig(resolved)
  return result.valid ? [] : result.errors
}
