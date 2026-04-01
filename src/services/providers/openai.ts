/**
 * OpenAI provider adapter.
 *
 * Translates between the shared internal inference contract and the OpenAI
 * Chat Completions API (https://platform.openai.com/docs/api-reference/chat).
 * Uses the native fetch API — the `openai` npm package is not a dependency.
 *
 * Phase-1 scope:
 * - Text generation (streaming)
 * - Tool / function calls (accumulated, yielded as AssistantMessage)
 * - Error normalization into SystemAPIErrorMessage
 *
 * Phase-1 non-goals (deferred to a follow-up change):
 * - Thinking / extended-thinking blocks (not supported by OpenAI)
 * - Prompt caching (not supported by OpenAI)
 * - Token estimation (uses character-based fallback)
 * - Model alias resolution (callers must pass fully-qualified names)
 */

import { randomUUID } from 'crypto'
import type {
  BetaContentBlock,
  BetaToolUnion,
  BetaUsage as Usage,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type {
  AssistantMessage,
  Message,
  SystemAPIErrorMessage,
  StreamEvent,
} from '../../types/message.js'
import type { Tools } from '../../Tool.js'
import { logForDebugging } from '../../utils/debug.js'
import type { SystemPrompt } from '../../utils/systemPromptType.js'
import type { ThinkingConfig } from '../../utils/thinking.js'
import type { Options } from '../api/claude.js'
import { createAssistantMessage } from '../../utils/messages.js'
import type { ProviderAdapter, ProviderExecuteRequest } from './adapter.js'
import type {
  OpenAIProviderConfig,
  ProviderCapabilities,
  ProviderError,
  ProviderErrorCategory,
} from './types.js'

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

const OPENAI_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolCalls: true,
  tokenEstimation: false, // uses character-based fallback
  modelAliasResolution: false, // callers must pass qualified names
  // Anthropic-only — not available on OpenAI.
  remoteSession: false,
  oauthSession: false,
  bridgeSession: false,
}

// ---------------------------------------------------------------------------
// OpenAI REST API shapes (minimal subset used here)
// ---------------------------------------------------------------------------

type OpenAIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | OpenAIContentPart[] }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: OpenAIToolCall[]
    }
  | { role: 'tool'; tool_call_id: string; content: string }

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type OpenAIToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

type OpenAITool = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

type OpenAIStreamChunk = {
  id: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        type?: 'function'
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

type OpenAIErrorBody = {
  error?: {
    message?: string
    code?: string
    type?: string
  }
}

type ToolFallbackContext = {
  enabled: boolean
  attempted: boolean
}

type OpenAIToolChoice =
  | 'auto'
  | {
      type: 'function'
      function: { name: string }
    }

const ignoredOptionWarnings = new Set<string>()

function warnIgnoredOptionOnce(
  providerName: string,
  optionName: string,
  reason: string,
): void {
  const key = `${providerName}:${optionName}`
  if (ignoredOptionWarnings.has(key)) {
    return
  }
  ignoredOptionWarnings.add(key)
  logForDebugging(
    `[provider:${providerName}] Ignoring option "${optionName}": ${reason}`,
    { level: 'warn' },
  )
}

// ---------------------------------------------------------------------------
// Message conversion: internal → OpenAI
// ---------------------------------------------------------------------------

function toOpenAIMessages(
  messages: Message[],
  systemPrompt: SystemPrompt,
): OpenAIMessage[] {
  const result: OpenAIMessage[] = []

  // System prompt — join all parts
  const systemText = systemPrompt.join('\n').trim()
  if (systemText) {
    result.push({ role: 'system', content: systemText })
  }

  for (const msg of messages) {
    if (msg.type === 'user') {
      const content = msg.message.content
      if (typeof content === 'string') {
        if (content.trim()) {
          result.push({ role: 'user', content })
        }
        continue
      }

      // Separate tool_results from text/image content blocks.
      // tool_results map to 'tool' role messages; text/image stay in 'user'.
      const toolResults: OpenAIMessage[] = []
      const userParts: OpenAIContentPart[] = []

      for (const block of content) {
        if (block.type === 'tool_result') {
          const toolBlock = block as {
            type: 'tool_result'
            tool_use_id: string
            content: unknown
          }
          const toolContent =
            typeof toolBlock.content === 'string'
              ? toolBlock.content
              : Array.isArray(toolBlock.content)
                ? (toolBlock.content as Array<{ type: string; text?: string }>)
                    .filter(b => b.type === 'text')
                    .map(b => b.text ?? '')
                    .join('\n')
                : JSON.stringify(toolBlock.content)
          toolResults.push({
            role: 'tool',
            tool_call_id: toolBlock.tool_use_id,
            content: toolContent,
          })
        } else if (block.type === 'text') {
          const textBlock = block as { type: 'text'; text: string }
          if (textBlock.text.trim()) {
            userParts.push({ type: 'text', text: textBlock.text })
          }
        } else if (block.type === 'image') {
          // image blocks carry base64 data or a URL; map to image_url
          const imgBlock = block as {
            type: 'image'
            source: {
              type: 'base64' | 'url'
              media_type?: string
              data?: string
              url?: string
            }
          }
          if (imgBlock.source.type === 'base64' && imgBlock.source.data) {
            userParts.push({
              type: 'image_url',
              image_url: {
                url: `data:${imgBlock.source.media_type ?? 'image/jpeg'};base64,${imgBlock.source.data}`,
              },
            })
          } else if (imgBlock.source.type === 'url' && imgBlock.source.url) {
            userParts.push({
              type: 'image_url',
              image_url: { url: imgBlock.source.url },
            })
          }
        }
        // Skip document, thinking, redacted_thinking, and other Anthropic-only blocks.
      }

      // tool_results are emitted as separate 'tool' messages (OpenAI requirement).
      result.push(...toolResults)

      // Remaining user content
      if (userParts.length === 1 && userParts[0]!.type === 'text') {
        result.push({ role: 'user', content: userParts[0]!.text })
      } else if (userParts.length > 0) {
        result.push({ role: 'user', content: userParts })
      }
    } else if (msg.type === 'assistant') {
      const content = msg.message.content
      if (typeof content === 'string') {
        result.push({ role: 'assistant', content })
        continue
      }

      const textParts: string[] = []
      const toolCalls: OpenAIToolCall[] = []

      for (const block of content) {
        if (block.type === 'text') {
          const tb = block as { type: 'text'; text: string }
          textParts.push(tb.text)
        } else if (block.type === 'tool_use') {
          const tu = block as {
            type: 'tool_use'
            id: string
            name: string
            input: unknown
          }
          toolCalls.push({
            id: tu.id,
            type: 'function',
            function: {
              name: tu.name,
              arguments: JSON.stringify(tu.input),
            },
          })
        }
        // Skip thinking / redacted_thinking — not supported by OpenAI.
      }

      const assistantMsg: Extract<OpenAIMessage, { role: 'assistant' }> = {
        role: 'assistant',
        content: textParts.join('') || null,
      }
      if (toolCalls.length > 0) {
        assistantMsg.tool_calls = toolCalls
      }
      result.push(assistantMsg)
    }
    // Skip system, tombstone, and other internal message types.
  }

  return result
}

// ---------------------------------------------------------------------------
// Tool schema conversion: internal → OpenAI
// ---------------------------------------------------------------------------

/**
 * Convert internal tools to OpenAI function schemas.
 * We call `tool.prompt()` to get the description — same as `toolToAPISchema`.
 */
async function toOpenAITools(
  tools: Tools,
  options: Parameters<ProviderExecuteRequest>[0]['options'],
): Promise<OpenAITool[]> {
  const result: OpenAITool[] = []
  for (const tool of tools) {
    if (!tool.isEnabled()) continue
    const { zodToJsonSchema } = await import('zod-to-json-schema')
    const inputSchema = (
      'inputJSONSchema' in tool && tool.inputJSONSchema
        ? tool.inputJSONSchema
        : zodToJsonSchema(tool.inputSchema)
    ) as Record<string, unknown>

    const description = await tool.prompt({
      getToolPermissionContext: options.getToolPermissionContext,
      tools,
      agents: options.agents,
      allowedAgentTypes: options.allowedAgentTypes,
    })

    result.push({
      type: 'function',
      function: {
        name: tool.name,
        description,
        parameters: inputSchema,
      },
    })
  }
  return result
}

function toOpenAIExtraTools(extraToolSchemas: BetaToolUnion[]): OpenAITool[] {
  const result: OpenAITool[] = []

  for (const schema of extraToolSchemas) {
    if (
      typeof schema !== 'object' ||
      schema === null ||
      !('name' in schema) ||
      typeof schema.name !== 'string' ||
      !('input_schema' in schema) ||
      typeof schema.input_schema !== 'object' ||
      schema.input_schema === null
    ) {
      continue
    }

    const description =
      'description' in schema && typeof schema.description === 'string'
        ? schema.description
        : ''

    result.push({
      type: 'function',
      function: {
        name: schema.name,
        description,
        parameters: schema.input_schema as Record<string, unknown>,
      },
    })
  }

  return result
}

function mergeOpenAITools(...toolSets: Array<OpenAITool[] | undefined>): OpenAITool[] {
  const merged = new Map<string, OpenAITool>()

  for (const toolSet of toolSets) {
    for (const tool of toolSet ?? []) {
      merged.set(tool.function.name, tool)
    }
  }

  return [...merged.values()]
}

function toOpenAIToolChoice(
  toolChoice: Options['toolChoice'],
  openaiTools: OpenAITool[] | undefined,
): OpenAIToolChoice | undefined {
  if (!toolChoice || !openaiTools || openaiTools.length === 0) {
    return undefined
  }

  if (toolChoice.type === 'auto') {
    return 'auto'
  }

  const hasRequestedTool = openaiTools.some(
    tool => tool.function.name === toolChoice.name,
  )
  if (!hasRequestedTool) {
    return undefined
  }

  return {
    type: 'function',
    function: { name: toolChoice.name },
  }
}

// ---------------------------------------------------------------------------
// Streaming SSE parser
// ---------------------------------------------------------------------------

async function* parseSSE(
  response: Response,
): AsyncGenerator<OpenAIStreamChunk> {
  if (!response.body) {
    throw new Error('OpenAI response has no body')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === ':') continue
        if (trimmed === 'data: [DONE]') return
        if (trimmed.startsWith('data: ')) {
          const json = trimmed.slice(6)
          try {
            yield JSON.parse(json) as OpenAIStreamChunk
          } catch {
            // malformed chunk — skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ---------------------------------------------------------------------------
// Synthetic usage record for provider-agnostic token tracking
// ---------------------------------------------------------------------------

function makeUsage(
  promptTokens: number,
  completionTokens: number,
): Usage {
  return {
    input_tokens: promptTokens,
    output_tokens: completionTokens,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  } as unknown as Usage
}

function mapFinishReason(
  finishReason: string | null,
): 'end_turn' | 'tool_use' | 'max_tokens' | null {
  switch (finishReason) {
    case 'stop':
      return 'end_turn'
    case 'tool_calls':
      return 'tool_use'
    case 'length':
      return 'max_tokens'
    default:
      return null
  }
}

function categoryForStatus(
  status: number,
  body?: OpenAIErrorBody,
): ProviderErrorCategory {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'quota'

  const code = body?.error?.code?.toLowerCase() ?? ''
  const message = body?.error?.message?.toLowerCase() ?? ''
  if (
    status === 400 &&
    (code.includes('deploymentnotfound') ||
      code.includes('model_not_found') ||
      message.includes('deployment') ||
      message.includes('model') ||
      message.includes('api version') ||
      message.includes('api-version'))
  ) {
    return 'config'
  }

  if (status >= 400 && status < 500) return 'protocol'
  return 'unknown'
}

function isToolUnsupportedError(
  status: number,
  body?: OpenAIErrorBody,
): boolean {
  if (status < 400 || status >= 500) return false
  const code = body?.error?.code?.toLowerCase() ?? ''
  const type = body?.error?.type?.toLowerCase() ?? ''
  const message = body?.error?.message?.toLowerCase() ?? ''
  return (
    code.includes('tool') ||
    code.includes('function') ||
    type.includes('tool') ||
    type.includes('function') ||
    message.includes('tool calling') ||
    message.includes('tool_calls') ||
    message.includes('tools are not supported') ||
    message.includes('functions are not supported') ||
    message.includes('does not support tools') ||
    message.includes('does not support function')
  )
}

function toProviderErrorFromHttp(
  status: number,
  bodyText: string,
  body?: OpenAIErrorBody,
): ProviderError {
  const message =
    body?.error?.message?.trim() || bodyText.trim() || `OpenAI HTTP ${status}`
  return {
    category: categoryForStatus(status, body),
    message,
    retryable: status === 429 || status >= 500,
  }
}

function toProviderErrorFromNetwork(error: unknown): ProviderError {
  return {
    category: 'unknown',
    message: error instanceof Error ? error.message : String(error),
    retryable: true,
    originalError: error,
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'x-app': 'claude-code',
  }
}

// ---------------------------------------------------------------------------
// OpenAI adapter implementation
// ---------------------------------------------------------------------------

export class OpenAIAdapter implements ProviderAdapter {
  constructor(protected readonly config: OpenAIProviderConfig) {}

  protected get providerName(): string {
    return 'openai'
  }

  get capabilities(): ProviderCapabilities {
    return {
      ...OPENAI_CAPABILITIES,
      toolCalls: !this.config.disableTools,
    }
  }

  protected get baseUrl(): string {
    return (this.config.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '')
  }

  protected get model(): string {
    return this.config.model
  }

  protected get apiKey(): string {
    return this.config.apiKey
  }

  protected get toolsEnabled(): boolean {
    return !this.config.disableTools
  }

  protected reportIgnoredOptions(options: Options): void {
    if (options.fetchOverride) {
      warnIgnoredOptionOnce(
        this.providerName,
        'fetchOverride',
        'OpenAI-compatible adapters currently use native fetch.',
      )
    }
    if (options.onStreamingFallback) {
      warnIgnoredOptionOnce(
        this.providerName,
        'onStreamingFallback',
        'OpenAI-compatible adapters do not use the Claude streaming fallback lifecycle.',
      )
    }
    if (options.enablePromptCaching !== undefined) {
      warnIgnoredOptionOnce(
        this.providerName,
        'enablePromptCaching',
        'Anthropic prompt caching is not supported on OpenAI-compatible providers.',
      )
    }
    if (options.skipCacheWrite) {
      warnIgnoredOptionOnce(
        this.providerName,
        'skipCacheWrite',
        'Cache-write controls are Anthropic-specific and are ignored here.',
      )
    }
    if (options.hasPendingMcpServers) {
      warnIgnoredOptionOnce(
        this.providerName,
        'hasPendingMcpServers',
        'This advisor/server-side gating hint is not used by OpenAI-compatible adapters.',
      )
    }
    if (options.advisorModel) {
      warnIgnoredOptionOnce(
        this.providerName,
        'advisorModel',
        'Advisor model support is currently Claude-only.',
      )
    }
    if (options.taskBudget) {
      warnIgnoredOptionOnce(
        this.providerName,
        'taskBudget',
        'API-side task budget is currently Claude-only.',
      )
    }
  }

  protected async getHeaders(): Promise<Record<string, string>> {
    return buildHeaders(this.apiKey)
  }

  protected getEndpointUrl(): string {
    return `${this.baseUrl}/v1/chat/completions`
  }

  executeRequest: ProviderExecuteRequest = ({
    messages,
    systemPrompt,
    tools,
    signal,
    options,
  }: {
    messages: Message[]
    systemPrompt: SystemPrompt
    thinkingConfig: ThinkingConfig
    tools: Tools
    signal: AbortSignal
    options: Options
  }) => {
    return this._stream({
      messages,
      systemPrompt,
      tools,
      signal,
      options,
      toolFallback: {
        enabled: this.toolsEnabled,
        attempted: false,
      },
    })
  }

  protected async *_stream({
    messages,
    systemPrompt,
    tools,
    signal,
    options,
    toolFallback,
  }: {
    messages: Message[]
    systemPrompt: SystemPrompt
    tools: Tools
    signal: AbortSignal
    options: Options
    toolFallback: ToolFallbackContext
  }): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage> {
    this.reportIgnoredOptions(options)

    // Convert internal messages and tools to OpenAI format
    const openaiMessages = toOpenAIMessages(messages, systemPrompt)
    const allTools = [...tools, ...options.mcpTools]
    const openaiTools =
      toolFallback.enabled && allTools.length > 0
        ? await toOpenAITools(allTools, options)
        : undefined
    const openaiExtraTools = toolFallback.enabled
      ? toOpenAIExtraTools(options.extraToolSchemas ?? [])
      : undefined
    const mergedOpenAITools = mergeOpenAITools(openaiTools, openaiExtraTools)
    const openaiToolChoice = toOpenAIToolChoice(
      options.toolChoice,
      mergedOpenAITools,
    )

    const body: Record<string, unknown> = {
      model: options.model || this.model,
      messages: openaiMessages,
      stream: true,
      stream_options: { include_usage: true },
      ...(mergedOpenAITools.length > 0 && { tools: mergedOpenAITools }),
      ...(openaiToolChoice && { tool_choice: openaiToolChoice }),
    }

    if (options.maxOutputTokensOverride) {
      body.max_tokens = options.maxOutputTokensOverride
    }
    if (options.temperatureOverride !== undefined) {
      body.temperature = options.temperatureOverride
    }
    if (options.stopSequences && options.stopSequences.length > 0) {
      body.stop = options.stopSequences
    }

    let response: Response
    try {
      response = await fetch(this.getEndpointUrl(), {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(body),
        signal,
      })
    } catch (fetchError) {
      yield* this._yieldProviderError(
        toProviderErrorFromNetwork(fetchError),
        0,
      )
      return
    }

    if (!response.ok) {
      const httpError = await this.readHttpError(response)
      if (
        toolFallback.enabled &&
        !toolFallback.attempted &&
        mergedOpenAITools.length > 0 &&
        isToolUnsupportedError(response.status, httpError.body)
      ) {
        yield* this._stream({
          messages,
          systemPrompt,
          tools,
          signal,
          options,
          toolFallback: {
            enabled: false,
            attempted: true,
          },
        })
        return
      }
      yield* this._yieldProviderError(httpError.providerError, response.status)
      return
    }

    // Accumulate streaming response
    const messageId = randomUUID()
    const modelName = String(body.model)
    let textAccumulator = ''
    const toolCallAccumulators: Map<
      number,
      { id: string; name: string; arguments: string }
    > = new Map()
    const startedToolBlocks = new Set<number>()
    let startedTextBlock = false
    let promptTokens = 0
    let completionTokens = 0
    let finishReason: string | null = null

    yield {
      type: 'stream_event',
      event: {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          model: modelName,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: makeUsage(0, 0),
        },
      } as StreamEvent['event'],
    }

    try {
      for await (const chunk of parseSSE(response)) {
        if (signal.aborted) break

        const usage = chunk.usage
        if (usage) {
          promptTokens = usage.prompt_tokens
          completionTokens = usage.completion_tokens
        }

        for (const choice of chunk.choices) {
          const delta = choice.delta
          if (choice.finish_reason) {
            finishReason = choice.finish_reason
          }

          // Accumulate text content
          if (delta.content) {
            if (!startedTextBlock) {
              startedTextBlock = true
              yield {
                type: 'stream_event',
                event: {
                  type: 'content_block_start',
                  index: 0,
                  content_block: {
                    type: 'text',
                    text: '',
                  },
                } as StreamEvent['event'],
              }
            }
            textAccumulator += delta.content
            yield {
              type: 'stream_event',
              event: {
                type: 'content_block_delta',
                index: 0,
                delta: {
                  type: 'text_delta',
                  text: delta.content,
                },
              } as StreamEvent['event'],
            }
          }

          // Accumulate tool call deltas
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index
              const blockIndex = idx + 1
              if (!toolCallAccumulators.has(idx)) {
                toolCallAccumulators.set(idx, {
                  id: tc.id ?? randomUUID(),
                  name: tc.function?.name ?? '',
                  arguments: '',
                })
              }
              const acc = toolCallAccumulators.get(idx)!
              if (!startedToolBlocks.has(idx)) {
                startedToolBlocks.add(idx)
                yield {
                  type: 'stream_event',
                  event: {
                    type: 'content_block_start',
                    index: blockIndex,
                    content_block: {
                      type: 'tool_use',
                      id: acc.id,
                      name: acc.name,
                      input: '',
                    },
                  } as StreamEvent['event'],
                }
              }
              if (tc.id && !acc.id) acc.id = tc.id
              if (tc.function?.name) {
                acc.name += tc.function.name
              }
              if (tc.function?.arguments) {
                acc.arguments += tc.function.arguments
                yield {
                  type: 'stream_event',
                  event: {
                    type: 'content_block_delta',
                    index: blockIndex,
                    delta: {
                      type: 'input_json_delta',
                      partial_json: tc.function.arguments,
                    },
                  } as StreamEvent['event'],
                }
              }
            }
          }
        }
      }
    } catch (streamError) {
      yield* this._yieldProviderError(toProviderErrorFromNetwork(streamError), 0)
      return
    }

    if (startedTextBlock) {
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_stop',
          index: 0,
        } as StreamEvent['event'],
      }
    }
    for (const idx of startedToolBlocks) {
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_stop',
          index: idx + 1,
        } as StreamEvent['event'],
      }
    }

    // Build content blocks in internal format
    const contentBlocks: BetaContentBlock[] = []

    if (textAccumulator) {
      contentBlocks.push({ type: 'text', text: textAccumulator } as BetaContentBlock)
    }

    for (const [, tc] of toolCallAccumulators) {
      let parsedInput: unknown = {}
      try {
        parsedInput = JSON.parse(tc.arguments)
      } catch {
        parsedInput = { _raw: tc.arguments }
      }
      contentBlocks.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: parsedInput,
      } as unknown as BetaContentBlock)
    }

    if (contentBlocks.length === 0) {
      contentBlocks.push({ type: 'text', text: '' } as BetaContentBlock)
    }

    const usage = makeUsage(promptTokens, completionTokens)
    yield {
      type: 'stream_event',
      event: {
        type: 'message_delta',
        delta: {
          stop_reason: mapFinishReason(finishReason),
          stop_sequence: null,
        },
        usage,
      } as StreamEvent['event'],
    }
    yield {
      type: 'stream_event',
      event: {
        type: 'message_stop',
      } as StreamEvent['event'],
    }
    const assistantMessage = createAssistantMessage({ content: contentBlocks, usage })
    yield assistantMessage
  }

  protected async readHttpError(response: Response): Promise<{
    bodyText: string
    body?: OpenAIErrorBody
    providerError: ProviderError
  }> {
    let bodyText = ''
    try {
      bodyText = await response.text()
    } catch {
      // ignore
    }

    let parsedBody: OpenAIErrorBody | undefined
    try {
      parsedBody = bodyText ? (JSON.parse(bodyText) as OpenAIErrorBody) : undefined
    } catch {
      // ignore malformed JSON bodies
    }

    return {
      bodyText,
      body: parsedBody,
      providerError: toProviderErrorFromHttp(response.status, bodyText, parsedBody),
    }
  }

  protected async *_yieldProviderError(
    providerError: ProviderError,
    status: number,
  ): AsyncGenerator<SystemAPIErrorMessage> {
    const { APIError, APIConnectionError } = await import('@anthropic-ai/sdk')
    let wrapped
    if (status === 0) {
      wrapped = new APIConnectionError({
        message: `OpenAI network error: ${providerError.message}`,
      })
    } else {
      wrapped = APIError.generate(
        status,
        { error: { message: providerError.message } },
        `OpenAI ${providerError.category} error`,
        {} as Headers,
      )
    }
    const { createSystemAPIErrorMessage } = await import('../../utils/messages.js')
    yield createSystemAPIErrorMessage(wrapped, 0, 0, 0)
  }
}
