/**
 * Azure OpenAI provider adapter — validation tests.
 *
 * Covers:
 *   4.1  Successful Azure OpenAI text generation and streaming flows
 *   4.2  Azure misconfiguration and authentication failure flows
 *   4.3  Capability reporting for unsupported / limited Azure OpenAI features
 *
 * Run with: bun test src/services/providers/azure.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AzureOpenAIAdapter } from './azure.js'
import { validateProviderConfig } from './config.js'
import { getProviderDiagnostics, formatProviderDiagnostics } from './diagnostics.js'

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  provider: 'azure-openai' as const,
  endpoint: 'https://my-resource.openai.azure.com',
  deployment: 'gpt-4o-deployment',
  apiVersion: '2024-02-01',
  apiKey: 'test-api-key',
}

/**
 * Build a minimal SSE response ReadableStream from data-event strings.
 */
function makeSseStream(dataLines: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(ctrl) {
      for (const line of dataLines) {
        ctrl.enqueue(enc.encode(`data: ${line}\n\n`))
      }
      ctrl.close()
    },
  })
}

/** Bare-minimum internal Message that satisfies the adapter's message conversion. */
function makeUserMessage(text: string) {
  return {
    type: 'user' as const,
    message: {
      role: 'user' as const,
      content: text,
    },
    uuid: 'msg-uuid',
    isSidechain: false,
    userType: 'external',
    cwd: '/',
    sessionId: 'sess',
    version: '1',
    timestamp: Date.now(),
  }
}

/** Collect all yielded values from `adapter.executeRequest`. */
async function collect(
  adapter: AzureOpenAIAdapter,
  fetchImpl: typeof globalThis.fetch,
  tools: unknown[] = [],
): Promise<unknown[]> {
  const origFetch = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    const results: unknown[] = []
    const gen = adapter.executeRequest({
      messages: [makeUserMessage('Hello') as never],
        systemPrompt: [],
        thinkingConfig: { type: 'disabled' } as never,
        tools: tools as never,
        signal: new AbortController().signal,
      options: {
        model: BASE_CONFIG.deployment,
        mcpTools: [],
        agents: [],
        allowedAgentTypes: [],
        getToolPermissionContext: () => ({}) as never,
      } as never,
    })
    for await (const item of gen) {
      results.push(item)
    }
    return results
  } finally {
    globalThis.fetch = origFetch
  }
}

function getEvents(results: unknown[]): Array<Record<string, unknown>> {
  return results.filter(
    (item): item is Record<string, unknown> =>
      !!item &&
      typeof item === 'object' &&
      (item as Record<string, unknown>).type === 'stream_event',
  )
}

function getAssistant(results: unknown[]): Record<string, unknown> | undefined {
  return results.find(
    (item): item is Record<string, unknown> =>
      !!item &&
      typeof item === 'object' &&
      (item as Record<string, unknown>).type === 'assistant',
  )
}

function makeDummyTool() {
  return {
    name: 'bash',
    inputJSONSchema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
      },
    },
    isEnabled: () => true,
    prompt: async () => 'Run a shell command',
  }
}

// ============================================================================
// 4.1 Successful text generation and streaming flows
// ============================================================================

describe('4.1 Azure OpenAI – successful streaming flows', () => {
  it('yields normalized stream events plus a final AssistantMessage for text streaming', async () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)

    const textChunk = JSON.stringify({
      id: 'chatcmpl-1',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: 'Hello from Azure!' },
          finish_reason: null,
        },
      ],
    })
    const usageChunk = JSON.stringify({
      id: 'chatcmpl-1',
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    })

    const fetchMock = async () =>
      new Response(makeSseStream([textChunk, usageChunk, '[DONE]']), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })

    const results = await collect(adapter, fetchMock as never)

    const events = getEvents(results)
    expect(events.length).toBeGreaterThan(0)
    expect(events.some(e => e.event && (e.event as Record<string, unknown>).type === 'message_start')).toBe(true)
    expect(events.some(e => e.event && (e.event as Record<string, unknown>).type === 'content_block_delta')).toBe(true)
    expect(events.some(e => e.event && (e.event as Record<string, unknown>).type === 'message_delta')).toBe(true)
    expect(events.some(e => e.event && (e.event as Record<string, unknown>).type === 'message_stop')).toBe(true)

    const msg = getAssistant(results)!
    expect(msg).toBeTruthy()
    const content = (msg.message as Record<string, unknown>).content as Array<
      Record<string, unknown>
    >
    const textBlock = content.find(b => b.type === 'text')
    expect(textBlock).toBeTruthy()
    expect(textBlock!.text).toBe('Hello from Azure!')
  })

  it('yields tool-call stream events and a final AssistantMessage with tool_use blocks', async () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)

    const chunk1 = JSON.stringify({
      id: 'chatcmpl-2',
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                index: 0,
                id: 'call_abc123',
                type: 'function',
                function: { name: 'bash', arguments: '' },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    })
    const chunk2 = JSON.stringify({
      id: 'chatcmpl-2',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              { index: 0, function: { arguments: '{"command":"ls -la"}' } },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    })

    const fetchMock = async () =>
      new Response(makeSseStream([chunk1, chunk2, '[DONE]']), { status: 200 })

    const results = await collect(adapter, fetchMock as never)

    const events = getEvents(results)
    expect(
      events.some(
        e =>
          e.event &&
          (e.event as Record<string, unknown>).type === 'content_block_start',
      ),
    ).toBe(true)
    expect(
      events.some(
        e =>
          e.event &&
          (e.event as Record<string, unknown>).type === 'content_block_delta',
      ),
    ).toBe(true)

    const msg = getAssistant(results)!
    expect(msg).toBeTruthy()

    const content = (msg.message as Record<string, unknown>).content as Array<
      Record<string, unknown>
    >
    const toolBlock = content.find(b => b.type === 'tool_use')
    expect(toolBlock).toBeTruthy()
    expect(toolBlock!.name).toBe('bash')
    expect(toolBlock!.input).toEqual({ command: 'ls -la' })
  })

  it('falls back to a no-tool request when Azure rejects tool calling', async () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)
    const seenBodies: Array<Record<string, unknown>> = []

    const fetchMock = async (_url: string, init?: RequestInit) => {
      const parsedBody = JSON.parse(String(init?.body ?? '{}')) as Record<
        string,
        unknown
      >
      seenBodies.push(parsedBody)

      if (seenBodies.length === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'OperationNotSupported',
              message: 'This deployment does not support tool calling.',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }

      const textChunk = JSON.stringify({
        id: 'chatcmpl-fallback',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: 'Fallback without tools' },
            finish_reason: 'stop',
          },
        ],
      })
      return new Response(makeSseStream([textChunk, '[DONE]']), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }

    const results = await collect(adapter, fetchMock as never, [makeDummyTool()])

    expect(seenBodies).toHaveLength(2)
    expect(seenBodies[0]).toHaveProperty('tools')
    expect(seenBodies[1]).not.toHaveProperty('tools')
    expect(getAssistant(results)?.type).toBe('assistant')
  })

  it('sends the request to the Azure deployment-aware endpoint URL', async () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)
    let capturedUrl = ''

    const fetchMock = async (url: string) => {
      capturedUrl = url as string
      return new Response(makeSseStream(['[DONE]']), { status: 200 })
    }

    await collect(adapter, fetchMock as never)

    expect(capturedUrl).toBe(
      'https://my-resource.openai.azure.com/openai/deployments/gpt-4o-deployment/chat/completions?api-version=2024-02-01',
    )
  })

  it('sends api-key header (not Authorization) when an API key is configured', async () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)
    let capturedHeaders: Record<string, string> = {}

    const fetchMock = async (_url: string, init: RequestInit) => {
      capturedHeaders = init.headers as Record<string, string>
      return new Response(makeSseStream(['[DONE]']), { status: 200 })
    }

    await collect(adapter, fetchMock as never)

    expect(capturedHeaders['api-key']).toBe('test-api-key')
    expect(capturedHeaders['Authorization']).toBeUndefined()
  })

  it('URI-encodes deployment names that contain special characters', async () => {
    const adapter = new AzureOpenAIAdapter({
      ...BASE_CONFIG,
      deployment: 'my deploy/v1',
    })
    let capturedUrl = ''

    const fetchMock = async (url: string) => {
      capturedUrl = url as string
      return new Response(makeSseStream(['[DONE]']), { status: 200 })
    }

    await collect(adapter, fetchMock as never)
    expect(capturedUrl).toContain(encodeURIComponent('my deploy/v1'))
  })
})

// ============================================================================
// 4.2 Misconfiguration and authentication failure flows
// ============================================================================

describe('4.2 Azure OpenAI — misconfiguration and auth failure flows', () => {
  // -- Config validation --

  it('fails validation when endpoint is missing', () => {
    const result = validateProviderConfig({
      provider: 'azure-openai',
      endpoint: '',
      deployment: 'my-deploy',
      apiVersion: '2024-02-01',
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes('AZURE_OPENAI_ENDPOINT'))).toBe(
        true,
      )
    }
  })

  it('fails validation when deployment is missing', () => {
    const result = validateProviderConfig({
      provider: 'azure-openai',
      endpoint: 'https://my-resource.openai.azure.com',
      deployment: '',
      apiVersion: '2024-02-01',
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(
        result.errors.some(e => e.includes('AZURE_OPENAI_DEPLOYMENT')),
      ).toBe(true)
    }
  })

  it('fails validation when API version is missing', () => {
    const result = validateProviderConfig({
      provider: 'azure-openai',
      endpoint: 'https://my-resource.openai.azure.com',
      deployment: 'my-deploy',
      apiVersion: '',
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(
        result.errors.some(e => e.includes('AZURE_OPENAI_API_VERSION')),
      ).toBe(true)
    }
  })

  it('reports all missing required fields when multiple are absent', () => {
    const result = validateProviderConfig({
      provider: 'azure-openai',
      endpoint: '',
      deployment: '',
      apiVersion: '',
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('passes validation when all required fields are present (no API key → Entra ID)', () => {
    const result = validateProviderConfig({
      provider: 'azure-openai',
      endpoint: 'https://my-resource.openai.azure.com',
      deployment: 'my-deploy',
      apiVersion: '2024-02-01',
    })
    expect(result.valid).toBe(true)
  })

  it('passes validation when an API key is provided alongside required fields', () => {
    const result = validateProviderConfig(BASE_CONFIG)
    expect(result.valid).toBe(true)
  })

  // -- Runtime auth / HTTP failure --

  it('yields a SystemAPIErrorMessage on HTTP 401 authentication failure', async () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)

    const fetchMock = async () =>
      new Response(JSON.stringify({ error: { message: 'Access denied' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })

    const results = await collect(adapter, fetchMock as never)

    expect(results).toHaveLength(1)
    const msg = results[0] as Record<string, unknown>
    // SystemAPIErrorMessage shape: { type: 'system', subtype: 'api_error' }
    expect(msg.type).toBe('system')
    expect(msg.subtype).toBe('api_error')
  })

  it('yields a SystemAPIErrorMessage on HTTP 403 forbidden', async () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)

    const fetchMock = async () =>
      new Response(JSON.stringify({ error: { message: 'Forbidden' } }), {
        status: 403,
      })

    const results = await collect(adapter, fetchMock as never)

    expect(results).toHaveLength(1)
    const msg = results[0] as Record<string, unknown>
    expect(msg.type).toBe('system')
    expect(msg.subtype).toBe('api_error')
  })

  it('yields a SystemAPIErrorMessage when the network call throws', async () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)

    const fetchMock = async (): Promise<Response> => {
      throw new Error('ECONNREFUSED')
    }

    const results = await collect(adapter, fetchMock as never)

    expect(results).toHaveLength(1)
    const msg = results[0] as Record<string, unknown>
    expect(msg.type).toBe('system')
    expect(msg.subtype).toBe('api_error')
  })

  it('does not propagate Azure-specific error details outside the adapter boundary', async () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)

    const azureErrorBody = JSON.stringify({
      error: {
        code: 'DeploymentNotFound',
        message: 'The deployment gpt-4o-deployment does not exist.',
        innererror: {
          code: 'AzureSpecificInternal',
          content_filter_result: { flagged: false },
        },
      },
    })

    const fetchMock = async () =>
      new Response(azureErrorBody, {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })

    const results = await collect(adapter, fetchMock as never)

    // The yielded item should be a SystemAPIErrorMessage, not a raw Azure error.
    expect(results).toHaveLength(1)
    const msg = results[0] as Record<string, unknown>
    expect(msg.type).toBe('system')
    expect(msg.subtype).toBe('api_error')
    // The raw Azure error shape must not be the top-level result.
    expect(msg).not.toHaveProperty('code')
    expect(msg).not.toHaveProperty('innererror')
  })
})

// ============================================================================
// 4.3 Capability reporting for unsupported / limited Azure OpenAI features
// ============================================================================

describe('4.3 Azure OpenAI — capability reporting', () => {
  it('declares streaming as supported', () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)
    expect(adapter.capabilities.streaming).toBe(true)
  })

  it('declares toolCalls as supported', () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)
    expect(adapter.capabilities.toolCalls).toBe(true)
  })

  it('declares toolCalls as unsupported when explicitly disabled', () => {
    const adapter = new AzureOpenAIAdapter({
      ...BASE_CONFIG,
      disableTools: true,
    })
    expect(adapter.capabilities.toolCalls).toBe(false)
  })

  it('declares tokenEstimation as unsupported (character-based fallback)', () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)
    expect(adapter.capabilities.tokenEstimation).toBe(false)
  })

  it('declares modelAliasResolution as unsupported (deployment names required)', () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)
    expect(adapter.capabilities.modelAliasResolution).toBe(false)
  })

  it('declares all Anthropic-only session features as unsupported', () => {
    const adapter = new AzureOpenAIAdapter(BASE_CONFIG)
    expect(adapter.capabilities.remoteSession).toBe(false)
    expect(adapter.capabilities.oauthSession).toBe(false)
    expect(adapter.capabilities.bridgeSession).toBe(false)
  })

  describe('diagnostics', () => {
    let savedEnv: NodeJS.ProcessEnv

    beforeEach(() => {
      savedEnv = { ...process.env }
      process.env.CLAUDE_CODE_PROVIDER = 'azure-openai'
      process.env.AZURE_OPENAI_ENDPOINT = 'https://my-resource.openai.azure.com'
      process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-4o-deployment'
      process.env.AZURE_OPENAI_API_VERSION = '2024-02-01'
      process.env.AZURE_OPENAI_API_KEY = 'test-key'
    })

    afterEach(() => {
      // Restore original env
      for (const key of Object.keys(process.env)) {
        if (!(key in savedEnv)) {
          delete process.env[key]
        } else {
          process.env[key] = savedEnv[key]
        }
      }
    })

    it('reports provider as azure-openai', () => {
      const diag = getProviderDiagnostics()
      expect(diag.provider).toBe('azure-openai')
    })

    it('includes endpoint, deployment, and api-version in endpoint context', () => {
      const diag = getProviderDiagnostics()
      expect(diag.endpoint).toContain('my-resource.openai.azure.com')
      expect(diag.endpoint).toContain('gpt-4o-deployment')
      expect(diag.endpoint).toContain('2024-02-01')
    })

    it('lists authentication method in limitations', () => {
      const diag = getProviderDiagnostics()
      const authLimitation = diag.limitations.find(l =>
        l.toLowerCase().includes('api key'),
      )
      expect(authLimitation).toBeTruthy()
    })

    it('lists Anthropic-only feature limitations', () => {
      const diag = getProviderDiagnostics()
      const anthropicLimitation = diag.limitations.find(l =>
        l.includes('Anthropic-only'),
      )
      expect(anthropicLimitation).toBeTruthy()
    })

    it('lists token estimation limitation', () => {
      const diag = getProviderDiagnostics()
      const tokenLimitation = diag.limitations.find(l =>
        l.toLowerCase().includes('token estimation'),
      )
      expect(tokenLimitation).toBeTruthy()
    })

    it('lists model alias limitation', () => {
      const diag = getProviderDiagnostics()
      const aliasLimitation = diag.limitations.find(l =>
        l.toLowerCase().includes('alias'),
      )
      expect(aliasLimitation).toBeTruthy()
    })

    it('lists tool-calling limitation when explicitly disabled', () => {
      process.env.AZURE_OPENAI_DISABLE_TOOLS = '1'
      const diag = getProviderDiagnostics()
      expect(diag.capabilities.toolCalls).toBe(false)
      const toolLimitation = diag.limitations.find(l =>
        l.toLowerCase().includes('tool calling is disabled'),
      )
      expect(toolLimitation).toBeTruthy()
    })

    it('reports Entra ID auth when no API key is configured', () => {
      delete process.env.AZURE_OPENAI_API_KEY
      const diag = getProviderDiagnostics()
      const authLimitation = diag.limitations.find(l =>
        l.includes('DefaultAzureCredential'),
      )
      expect(authLimitation).toBeTruthy()
    })

    it('formatProviderDiagnostics produces human-readable output containing provider and endpoint', () => {
      const diag = getProviderDiagnostics()
      const formatted = formatProviderDiagnostics(diag)
      expect(formatted).toContain('azure-openai')
      expect(formatted).toContain('my-resource.openai.azure.com')
    })
  })
})
