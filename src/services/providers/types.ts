/**
 * Shared normalized types for the provider adapter boundary.
 *
 * These types are intentionally independent of the Anthropic SDK so they can
 * be consumed by OpenAI-compatible adapters without importing SDK internals.
 */

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Capabilities declared by each provider adapter.
 * Callers gate behavior on these flags instead of hard-coding provider checks.
 */
export type ProviderCapabilities = {
  /** Provider can stream text responses incrementally. */
  streaming: boolean
  /** Provider supports structured tool / function calls. */
  toolCalls: boolean
  /**
   * Provider can estimate prompt token counts before sending.
   * When false, callers fall back to character-based estimation.
   */
  tokenEstimation: boolean
  /**
   * Provider can resolve short model aliases (e.g. "sonnet") to versioned IDs.
   * When false, callers must pass fully-qualified model names.
   */
  modelAliasResolution: boolean

  // -- Anthropic-only session features --
  // These are NOT available on OpenAI-compatible providers.
  // Gate any caller that depends on them behind these flags.

  /** Supports Anthropic remote-control / bridge sessions. */
  remoteSession: boolean
  /** Supports Anthropic claude.ai OAuth authentication. */
  oauthSession: boolean
  /** Supports Anthropic bridge session ingress. */
  bridgeSession: boolean
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Normalized error categories for provider-independent error handling. */
export type ProviderErrorCategory =
  | 'auth' // Authentication or authorization failure
  | 'config' // Missing or invalid configuration input
  | 'quota' // Rate-limit or quota exceeded
  | 'protocol' // Unexpected API response format or protocol error
  | 'unknown'

export type ProviderError = {
  category: ProviderErrorCategory
  message: string
  /** True when the operation may succeed on retry. */
  retryable: boolean
  originalError?: unknown
}

// ---------------------------------------------------------------------------
// Provider identity
// ---------------------------------------------------------------------------

/**
 * User-facing provider names used in configuration and diagnostics.
 * Distinct from the internal `APIProvider` enum which only covers
 * Anthropic-compatible deployment paths.
 */
export type ModelProvider = 'claude' | 'openai' | 'azure-openai'

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export type ClaudeProviderConfig = {
  provider: 'claude'
}

export type OpenAIProviderConfig = {
  provider: 'openai'
  /** OpenAI API key (OPENAI_API_KEY). */
  apiKey: string
  /** Override base URL (e.g. for a compatible proxy). Defaults to api.openai.com. */
  baseUrl?: string
  /** Fully-qualified model identifier (e.g. "gpt-4o"). */
  model: string
  /** Disable tool calling for runtimes that do not support function calls. */
  disableTools?: boolean
}

export type AzureOpenAIProviderConfig = {
  provider: 'azure-openai'
  /** Azure OpenAI resource endpoint, e.g. https://my-resource.openai.azure.com */
  endpoint: string
  /** Deployment name inside the Azure resource. */
  deployment: string
  /** Azure OpenAI API version, e.g. "2024-02-01". */
  apiVersion: string
  /**
   * API key for key-based auth (AZURE_OPENAI_API_KEY).
   * When absent, DefaultAzureCredential is used for Entra ID authentication.
   */
  apiKey?: string
  /** Disable tool calling for deployments that do not support function calls. */
  disableTools?: boolean
}

export type ProviderConfig =
  | ClaudeProviderConfig
  | OpenAIProviderConfig
  | AzureOpenAIProviderConfig

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export type ProviderValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] }

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type ProviderDiagnostics = {
  provider: ModelProvider
  /** Human-readable endpoint context (base URL, resource name, region, etc.) */
  endpoint: string
  /**
   * Resolved model or deployment target that will be sent to the provider.
   * For Claude, reflects the configured alias or model env var (alias resolution
   * happens at runtime). For OpenAI/Azure, reflects the fully-qualified
   * model or deployment name from config.
   */
  resolvedModel: string
  /**
   * Describes the credential source or auth method in use.
   * Shows auth state without revealing secrets or token values.
   */
  credentialSource: string
  capabilities: ProviderCapabilities
  /** Capability or configuration limitations that affect runtime behavior. */
  limitations: string[]
}
