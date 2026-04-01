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

/**
 * Validate the active provider configuration and throw if required fields
 * are missing.  Call this during startup / bootstrap — not inside the query
 * hot path.
 *
 * For the "claude" provider this is a no-op (existing auth layers handle it).
 * For "openai" and "azure-openai" this surfaces missing credentials early.
 */
export function assertProviderConfigValid(config?: ProviderConfig): void {
  const resolved = config ?? getProviderConfig()
  const result = validateProviderConfig(resolved)

  if (!result.valid) {
    const header = `Provider configuration error (provider: ${resolved.provider}):`
    const body = result.errors.map(e => `  • ${e}`).join('\n')
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
