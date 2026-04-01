/**
 * Azure OpenAI provider adapter.
 *
 * Extends the OpenAI adapter with Azure-specific endpoint construction,
 * deployment routing, and API-version handling.
 *
 * Authentication:
 *   - API key (AZURE_OPENAI_API_KEY) → `api-key` header
 *   - When absent, uses @azure/identity DefaultAzureCredential (Entra ID)
 *
 * Endpoint format:
 *   https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}
 *
 * Note: The existing `foundry` path uses @anthropic-ai/foundry-sdk which is a
 * separate Anthropic-compatible Azure integration. This adapter is for the
 * Azure OpenAI Service accessed through the standard OpenAI-compatible REST API.
 */

import type { AzureOpenAIProviderConfig, ProviderCapabilities } from './types.js'
import { OpenAIAdapter } from './openai.js'

const AZURE_OPENAI_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolCalls: true,
  tokenEstimation: false,
  modelAliasResolution: false,
  // Anthropic-only — not available on Azure OpenAI.
  remoteSession: false,
  oauthSession: false,
  bridgeSession: false,
}

export class AzureOpenAIAdapter extends OpenAIAdapter {
  private azureADTokenProviderPromise?:
    | Promise<() => Promise<string>>
    | undefined

  constructor(private readonly azureConfig: AzureOpenAIProviderConfig) {
    // Pass a synthetic OpenAI config to satisfy the parent constructor.
    // Azure-specific fields override the inherited URL/key getters below.
    super({
      provider: 'openai',
      apiKey: azureConfig.apiKey ?? '',
      model: azureConfig.deployment,
    })
  }

  override get baseUrl(): string {
    return this.azureConfig.endpoint.replace(/\/$/, '')
  }

  override get model(): string {
    return this.azureConfig.deployment
  }

  override get apiKey(): string {
    return this.azureConfig.apiKey ?? ''
  }

  override get capabilities(): ProviderCapabilities {
    return {
      ...AZURE_OPENAI_CAPABILITIES,
      toolCalls: !this.azureConfig.disableTools,
    }
  }

  override get toolsEnabled(): boolean {
    return !this.azureConfig.disableTools
  }

  /**
   * Azure OpenAI endpoint:
   * https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}
   */
  override getEndpointUrl(): string {
    return `${this.baseUrl}/openai/deployments/${encodeURIComponent(this.azureConfig.deployment)}/chat/completions?api-version=${encodeURIComponent(this.azureConfig.apiVersion)}`
  }

  private async getAzureADTokenProvider(): Promise<() => Promise<string>> {
    if (!this.azureADTokenProviderPromise) {
      this.azureADTokenProviderPromise = (async () => {
        const {
          DefaultAzureCredential,
          getBearerTokenProvider,
        } = await import('@azure/identity')
        return getBearerTokenProvider(
          new DefaultAzureCredential(),
          'https://cognitiveservices.azure.com/.default',
        )
      })()
    }
    return this.azureADTokenProviderPromise
  }

  /**
   * Azure uses `api-key` for key auth and a bearer token for Entra ID auth.
   */
  override async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-app': 'claude-code',
    }
    if (this.azureConfig.apiKey) {
      headers['api-key'] = this.azureConfig.apiKey
    } else {
      const getToken = await this.getAzureADTokenProvider()
      headers.Authorization = `Bearer ${await getToken()}`
    }
    return headers
  }
}
