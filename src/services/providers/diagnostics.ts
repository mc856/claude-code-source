/**
 * Provider diagnostics — surfaced at startup and in status output.
 *
 * Reports the active provider, relevant endpoint context, and any
 * capability limitations that affect runtime behaviour.
 */

import { getAPIProvider } from '../../utils/model/providers.js'
import { getProviderConfig } from './config.js'
import { getProviderAdapter } from './registry.js'
import type { ProviderDiagnostics } from './types.js'

/**
 * Build a diagnostics snapshot for the currently-configured provider.
 * This is intentionally synchronous and cheap — no network calls.
 */
export function getProviderDiagnostics(): ProviderDiagnostics {
  const config = getProviderConfig()
  const adapter = getProviderAdapter(config)
  const { capabilities } = adapter
  const limitations: string[] = []

  let endpoint: string

  switch (config.provider) {
    case 'claude': {
      // Report the active Anthropic-compatible sub-path and endpoint context.
      const subProvider = getAPIProvider()
      const baseUrlOverride = process.env.ANTHROPIC_BASE_URL

      switch (subProvider) {
        case 'bedrock': {
          const region =
            process.env.AWS_REGION ||
            process.env.AWS_DEFAULT_REGION ||
            'us-east-1'
          endpoint = `AWS Bedrock (region: ${region})`
          break
        }
        case 'vertex': {
          const project =
            process.env.ANTHROPIC_VERTEX_PROJECT_ID ||
            process.env.GOOGLE_CLOUD_PROJECT ||
            '<project-not-set>'
          const region = process.env.CLOUD_ML_REGION || 'us-east5'
          endpoint = `Google Vertex AI (project: ${project}, region: ${region})`
          break
        }
        case 'foundry': {
          const resource =
            process.env.ANTHROPIC_FOUNDRY_RESOURCE ||
            process.env.ANTHROPIC_FOUNDRY_BASE_URL ||
            '<resource-not-set>'
          endpoint = `Azure AI Foundry (${resource})`
          break
        }
        default: {
          endpoint = baseUrlOverride
            ? `Anthropic API (${baseUrlOverride})`
            : 'Anthropic API (api.anthropic.com)'
          break
        }
      }
      break
    }

    case 'openai': {
      const base = config.baseUrl ?? 'https://api.openai.com'
      endpoint = `OpenAI API (${base}, model: ${config.model})`
      if (!capabilities.tokenEstimation) {
        limitations.push(
          'Token estimation uses character-based fallback (tiktoken not available).',
        )
      }
      if (!capabilities.modelAliasResolution) {
        limitations.push(
          'Model aliases (e.g. "sonnet") are not resolved — use fully-qualified names.',
        )
      }
      if (!capabilities.remoteSession) {
        limitations.push(
          'Remote-control, bridge sessions, and OAuth are Anthropic-only features ' +
            'and are not available with OpenAI.',
        )
      }
      break
    }

    case 'azure-openai': {
      endpoint =
        `Azure OpenAI (endpoint: ${config.endpoint}, ` +
        `deployment: ${config.deployment}, api-version: ${config.apiVersion})`
      if (!capabilities.tokenEstimation) {
        limitations.push(
          'Token estimation uses character-based fallback (tiktoken not available).',
        )
      }
      if (!capabilities.modelAliasResolution) {
        limitations.push(
          'Model aliases are not resolved — use fully-qualified deployment names.',
        )
      }
      if (!capabilities.remoteSession) {
        limitations.push(
          'Remote-control, bridge sessions, and OAuth are Anthropic-only features ' +
            'and are not available with Azure OpenAI.',
        )
      }
      const authMethod = config.apiKey
        ? 'API key (AZURE_OPENAI_API_KEY)'
        : 'DefaultAzureCredential (Entra ID)'
      limitations.push(`Authentication: ${authMethod}`)
      break
    }
  }

  return {
    provider: config.provider,
    endpoint,
    capabilities,
    limitations,
  }
}

/**
 * Format diagnostics as a human-readable string for startup output.
 */
export function formatProviderDiagnostics(diag: ProviderDiagnostics): string {
  const lines: string[] = [
    `Provider: ${diag.provider}`,
    `Endpoint: ${diag.endpoint}`,
  ]
  if (diag.limitations.length > 0) {
    lines.push('Limitations:')
    for (const lim of diag.limitations) {
      lines.push(`  • ${lim}`)
    }
  }
  return lines.join('\n')
}
