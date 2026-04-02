import { describe, it, expect } from 'bun:test'
import { getProviderAdapter } from './registry.js'
import type { ProviderAdapter } from './adapter.js'

const BASE_CONFIG = {
  provider: 'openai' as const,
  apiKey: 'test-openai-key',
  model: 'gpt-4o',
  baseUrl: 'https://proxy.example.test',
}

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

async function collect(
  adapter: ProviderAdapter,
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
        model: BASE_CONFIG.model,
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

describe('OpenAI provider adapter', () => {
  it('uses the configured base URL and bearer auth header', async () => {
    const adapter = getProviderAdapter(BASE_CONFIG)
    let capturedUrl = ''
    let capturedHeaders: Record<string, string> = {}

    const fetchMock = async (url: string, init?: RequestInit) => {
      capturedUrl = url
      capturedHeaders = init?.headers as Record<string, string>
      return new Response(makeSseStream(['[DONE]']), { status: 200 })
    }

    await collect(adapter, fetchMock as never)

    expect(capturedUrl).toBe('https://proxy.example.test/v1/chat/completions')
    expect(capturedHeaders.Authorization).toBe('Bearer test-openai-key')
  })

  it('yields normalized stream events and a final AssistantMessage for text streaming', async () => {
    const adapter = getProviderAdapter(BASE_CONFIG)
    const textChunk = JSON.stringify({
      id: 'chatcmpl-1',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: 'Hello from OpenAI!' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
    })

    const fetchMock = async () =>
      new Response(makeSseStream([textChunk, '[DONE]']), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })

    const results = await collect(adapter, fetchMock as never)
    const events = getEvents(results)

    expect(events.some(e => e.event && e.event.type === 'message_start')).toBe(
      true,
    )
    expect(
      events.some(e => e.event && e.event.type === 'content_block_delta'),
    ).toBe(true)
    expect(events.some(e => e.event && e.event.type === 'message_stop')).toBe(
      true,
    )

    const msg = getAssistant(results)
    expect(msg?.type).toBe('assistant')
    const content = (msg?.message as Record<string, unknown>).content as Array<
      Record<string, unknown>
    >
    expect(content.find(block => block.type === 'text')?.text).toBe(
      'Hello from OpenAI!',
    )
  })

  it('retries once without tools when the backend rejects tool calling', async () => {
    const adapter = getProviderAdapter(BASE_CONFIG)
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
              type: 'invalid_request_error',
              message: 'This model does not support tool calling.',
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

  it('yields a SystemAPIErrorMessage when the network call throws', async () => {
    const adapter = getProviderAdapter(BASE_CONFIG)

    const fetchMock = async (): Promise<Response> => {
      throw new Error('ECONNREFUSED')
    }

    const results = await collect(adapter, fetchMock as never)
    const msg = results[0] as Record<string, unknown>

    expect(results).toHaveLength(1)
    expect(msg.type).toBe('system')
    expect(msg.subtype).toBe('api_error')
  })

  it('disables tool capability when explicitly configured', () => {
    const adapter = getProviderAdapter({
      ...BASE_CONFIG,
      disableTools: true,
    })

    expect(adapter.capabilities.toolCalls).toBe(false)
  })
})
