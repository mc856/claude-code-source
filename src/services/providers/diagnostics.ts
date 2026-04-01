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
  let resolvedModel: string
  let credentialSource: string

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
          credentialSource = 'AWS credentials (IAM / instance profile)'
          break
        }
        case 'vertex': {
          const project =
            process.env.ANTHROPIC_VERTEX_PROJECT_ID ||
            process.env.GOOGLE_CLOUD_PROJECT ||
            '<project-not-set>'
          const region = process.env.CLOUD_ML_REGION || 'us-east5'
          endpoint = `Google Vertex AI (project: ${project}, region: ${region})`
          credentialSource = 'Google Cloud credentials (ADC)'
          break
        }
        case 'foundry': {
          const resource =
            process.env.ANTHROPIC_FOUNDRY_RESOURCE ||
            process.env.ANTHROPIC_FOUNDRY_BASE_URL ||
            '<resource-not-set>'
          endpoint = `Azure AI Foundry (${resource})`
          credentialSource = 'Azure AI Foundry credentials'
          break
        }
        default: {
          endpoint = baseUrlOverride
            ? `Anthropic API (${baseUrlOverride})`
            : 'Anthropic API (api.anthropic.com)'
          credentialSource = process.env.ANTHROPIC_API_KEY
            ? 'ANTHROPIC_API_KEY'
            : 'OAuth / keychain'
          break
        }
      }

      // Resolved model: show configured override or indicate runtime resolution.
      resolvedModel = process.env.ANTHROPIC_MODEL
        ? `${process.env.ANTHROPIC_MODEL} (ANTHROPIC_MODEL)`
        : 'resolved at runtime (alias or default)'
      break
    }

    case 'openai': {
      const base = config.baseUrl ?? 'https://api.openai.com'
      endpoint = `OpenAI API (${base})`
      resolvedModel = config.model
      credentialSource = config.apiKey
        ? 'OPENAI_API_KEY (set)'
        : 'OPENAI_API_KEY (missing)'
      if (!capabilities.toolCalls) {
        limitations.push(
          'Tool calling is disabled for this OpenAI runtime; requests will run without tools.',
        )
      }
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
        `Azure OpenAI (endpoint: ${config.endpoint}, api-version: ${config.apiVersion})`
      resolvedModel = config.deployment
        ? `${config.deployment} (deployment)`
        : '<deployment not set>'
      credentialSource = config.apiKey
        ? 'AZURE_OPENAI_API_KEY (set)'
        : 'DefaultAzureCredential (Entra ID)'
      if (!capabilities.toolCalls) {
        limitations.push(
          'Tool calling is disabled for this Azure OpenAI deployment/runtime; requests will run without tools.',
        )
      }
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
      break
    }
  }

  return {
    provider: config.provider,
    endpoint,
    resolvedModel,
    credentialSource,
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
    `Model: ${diag.resolvedModel}`,
    `Credentials: ${diag.credentialSource}`,
  ]
  if (diag.limitations.length > 0) {
    lines.push('Limitations:')
    for (const lim of diag.limitations) {
      lines.push(`  • ${lim}`)
    }
  }
  return lines.join('\n')
}
