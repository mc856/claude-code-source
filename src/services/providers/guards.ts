/**
 * Scope guards for Anthropic-only features.
 *
 * OAuth, bridge sessions, session-ingress, and remote-control flows are
 * Anthropic-specific and must NOT be treated as generic provider behaviour.
 * These guards allow callers to check capabilities before attempting
 * Anthropic-only paths, rather than discovering failures at runtime.
 *
 * Usage pattern:
 *
 *   if (!requiresAnthropicProvider('OAuth login')) return
 *   // ... Anthropic-only code here
 *
 * The guard logs a warning and returns false when the active provider does
 * not support the requested feature. It does NOT throw — callers decide how
 * to handle the unsupported state (skip, surface a user-visible message, etc.)
 */

import { logForDebugging } from '../../utils/debug.js'
import { getProviderAdapter } from './registry.js'

// ---------------------------------------------------------------------------
// Capability checks
// ---------------------------------------------------------------------------

/** True when the active provider supports OAuth-based session authentication. */
export function supportsOAuthSession(): boolean {
  return getProviderAdapter().capabilities.oauthSession
}

/** True when the active provider supports remote-control / bridge sessions. */
export function supportsRemoteSession(): boolean {
  return getProviderAdapter().capabilities.remoteSession
}

/** True when the active provider supports Anthropic bridge session ingress. */
export function supportsBridgeSession(): boolean {
  return getProviderAdapter().capabilities.bridgeSession
}

/** True when the active provider supports streaming. */
export function supportsStreaming(): boolean {
  return getProviderAdapter().capabilities.streaming
}

/** True when the active provider supports structured tool / function calls. */
export function supportsToolCalls(): boolean {
  return getProviderAdapter().capabilities.toolCalls
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Log a warning and return false when the active provider does NOT support
 * Anthropic-only session features (OAuth, bridge, remote-control).
 *
 * @param featureName  Human-readable name of the feature for the log message.
 * @returns true when the feature is available, false when it is not.
 */
export function requiresAnthropicProvider(featureName: string): boolean {
  const caps = getProviderAdapter().capabilities
  if (caps.oauthSession && caps.remoteSession && caps.bridgeSession) {
    return true
  }
  logForDebugging(
    `[provider] "${featureName}" is an Anthropic-only feature and is not available ` +
      'with the currently configured provider. ' +
      'Set CLAUDE_CODE_PROVIDER=claude (or unset it) to use this feature.',
    { level: 'warn' },
  )
  return false
}

/**
 * Throw if the active provider does not support Anthropic-only session features.
 * Use this in code paths where continuing without the feature would be unsafe.
 */
export function assertAnthropicProvider(featureName: string): void {
  if (!requiresAnthropicProvider(featureName)) {
    throw new Error(
      `"${featureName}" requires the Claude (Anthropic) provider. ` +
        'Set CLAUDE_CODE_PROVIDER=claude or leave CLAUDE_CODE_PROVIDER unset.',
    )
  }
}
