/**
 * Provider abstraction — public surface.
 *
 * Import from this module when you need provider-agnostic inference,
 * configuration helpers, or diagnostics. Avoid importing sub-modules directly.
 */

// Core types
export type {
  ProviderCapabilities,
  ProviderConfig,
  ProviderDiagnostics,
  ProviderError,
  ProviderErrorCategory,
  ProviderValidationResult,
  ModelProvider,
  ClaudeProviderConfig,
  OpenAIProviderConfig,
  AzureOpenAIProviderConfig,
} from './types.js'

// Adapter interface
export type { ProviderAdapter, ProviderExecuteRequest } from './adapter.js'

// Registry
export { getProviderAdapter, providerCallModel } from './registry.js'

// Configuration
export {
  getProviderConfig,
  validateProviderConfig,
  isAnthropicCompatibleProvider,
  isAnthropicOnlyFeaturesAvailable,
} from './config.js'

// Diagnostics
export { getProviderDiagnostics, formatProviderDiagnostics } from './diagnostics.js'

// Scope guards for Anthropic-only features (Tasks 5.1 / 5.2)
export {
  supportsOAuthSession,
  supportsRemoteSession,
  supportsBridgeSession,
  supportsStreaming,
  supportsToolCalls,
  requiresAnthropicProvider,
  assertAnthropicProvider,
} from './guards.js'

// Startup validation
export {
  assertProviderConfigValid,
  getProviderConfigErrors,
  validateProviderModelCombination,
} from './validate.js'
