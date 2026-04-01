/**
 * ProviderAdapter — the normalized provider contract for the main inference path.
 *
 * All provider implementations (Claude, OpenAI, Azure OpenAI) expose this
 * interface. Higher-level code (query.ts, deps.ts) depends only on this
 * contract and never imports provider-SDK types directly.
 *
 * Design note: `executeRequest` intentionally matches the signature of
 * `queryModelWithStreaming` so it can be dropped in as a `callModel` dep.
 * Using `typeof queryModelWithStreaming` keeps the two in sync automatically.
 */

import type { queryModelWithStreaming } from '../api/claude.js'
import type { ProviderCapabilities } from './types.js'

/**
 * The execute-request function type that every provider adapter must implement.
 * Matches the signature of `queryModelWithStreaming` exactly so adapters are
 * drop-in replacements in `QueryDeps.callModel`.
 */
export type ProviderExecuteRequest = typeof queryModelWithStreaming

/**
 * A provider adapter wraps a single inference backend (Claude, OpenAI, Azure).
 *
 * Each adapter is responsible for:
 * - Translating the normalized request into provider-specific format
 * - Executing the request (streaming or non-streaming)
 * - Normalizing provider-specific streaming events, tool-call payloads,
 *   and errors back into the shared internal representation
 * - Declaring its capabilities so callers can gate unsupported features
 */
export interface ProviderAdapter {
  /** Static capability declaration for this provider. */
  readonly capabilities: ProviderCapabilities

  /**
   * Execute a model request through this provider.
   *
   * The adapter normalizes provider output into the existing internal
   * message and tool-call representation (tool_use / tool_result) so
   * query.ts and the tool execution stack can remain provider-agnostic.
   */
  executeRequest: ProviderExecuteRequest
}
