/**
 * Provider registry - maps runtime configuration to the correct adapter instance.
 *
 * `getProviderAdapter()` is the single factory for adapter construction.
 * `providerCallModel()` is a drop-in replacement for `queryModelWithStreaming`
 * that routes through the active adapter and is wired into `QueryDeps.callModel`.
 *
 * # Provider selection precedence (resolved by getProviderConfig):
 *   1. --provider CLI flag
 *   2. settings.provider
 *   3. CLAUDE_CODE_PROVIDER env var
 *   4. Legacy Anthropic-compatible env vars (CLAUDE_CODE_USE_BEDROCK etc.) -> "claude"
 *   5. Default: "claude"
 *
 * # Anthropic-only features
 * Features such as OAuth, bridge sessions, and remote-control are gated by
 * adapter capabilities and are NOT routed through the generic provider path.
 * See `isAnthropicOnlyFeaturesAvailable()` in config.ts and the scope guards
 * in the files that expose those features.
 */

import type { queryModelWithStreaming } from '../api/claude.js'
import type { ProviderAdapter } from './adapter.js'
import { AzureOpenAIAdapter } from './azure.js'
import { claudeAdapter } from './claude.js'
import { getProviderConfig } from './config.js'
import { OpenAIAdapter } from './openai.js'
import type { ProviderConfig } from './types.js'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Return the ProviderAdapter for the given config, or the active config
 * when called with no argument.
 */
export function getProviderAdapter(config?: ProviderConfig): ProviderAdapter {
  const resolved = config ?? getProviderConfig()

  switch (resolved.provider) {
    case 'claude':
      return claudeAdapter
    case 'openai':
      return new OpenAIAdapter(resolved)
    case 'azure-openai':
      return new AzureOpenAIAdapter(resolved)
  }
}

// ---------------------------------------------------------------------------
// Drop-in callModel replacement
// ---------------------------------------------------------------------------

/**
 * Provider-aware replacement for `queryModelWithStreaming`.
 *
 * This function has the exact same signature as `queryModelWithStreaming` and
 * can be set as `QueryDeps.callModel` in `productionDeps()`.
 *
 * When the resolved provider is "claude", it delegates to the existing
 * `claudeAdapter` -> `queryModelWithStreaming` with zero behaviour change.
 * For "openai" or "azure-openai" it routes to the respective adapter.
 */
export function providerCallModel(
  ...args: Parameters<typeof queryModelWithStreaming>
): ReturnType<typeof queryModelWithStreaming> {
  return getProviderAdapter().executeRequest(...args)
}
