/**
 * Claude provider adapter — wraps the existing Anthropic-compatible inference paths.
 *
 * This adapter covers all four current Anthropic-backed deployments:
 *   - firstParty  (direct Anthropic API)
 *   - bedrock     (AWS Bedrock)
 *   - vertex      (Google Vertex AI)
 *   - foundry     (Azure AI Foundry via @anthropic-ai/foundry-sdk)
 *
 * Provider selection among these sub-paths continues to be governed by the
 * existing CLAUDE_CODE_USE_BEDROCK / CLAUDE_CODE_USE_VERTEX /
 * CLAUDE_CODE_USE_FOUNDRY environment variables inside `queryModelWithStreaming`
 * and `getAnthropicClient()`. The adapter boundary sits above that logic.
 *
 * Anthropic-only session features (remote-control, bridge, OAuth) remain
 * outside the generic provider abstraction and are not surfaced here.
 */

import { queryModelWithStreaming } from '../api/claude.js'
import type { ProviderAdapter } from './adapter.js'
import type { ProviderCapabilities } from './types.js'

const CLAUDE_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolCalls: true,
  tokenEstimation: true,
  modelAliasResolution: true,
  // Anthropic-only session features — available on this adapter only.
  remoteSession: true,
  oauthSession: true,
  bridgeSession: true,
}

/**
 * The Claude adapter delegates directly to `queryModelWithStreaming`, which
 * already handles firstParty / Bedrock / Vertex / Foundry branching internally.
 * No behaviour change is introduced for existing Anthropic-compatible users.
 */
export const claudeAdapter: ProviderAdapter = {
  capabilities: CLAUDE_CAPABILITIES,
  executeRequest: queryModelWithStreaming,
}
