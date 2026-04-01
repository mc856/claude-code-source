import type Anthropic from '@anthropic-ai/sdk'
import type { BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages.js'
import {
  getLastApiCompletionTimestamp,
  setLastApiCompletionTimestamp,
} from '../bootstrap/state.js'
import { STRUCTURED_OUTPUTS_BETA_HEADER } from '../constants/betas.js'
import type { QuerySource } from '../constants/querySource.js'
import {
  getAttributionHeader,
  getCLISyspromptPrefix,
} from '../constants/system.js'
import { logEvent } from '../services/analytics/index.js'
import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../services/analytics/metadata.js'
import {
  getAPIMetadata,
  queryModelWithoutStreaming,
  type Options,
} from '../services/api/claude.js'
import { getAnthropicClient } from '../services/api/client.js'
import { getProviderConfig } from '../services/providers/config.js'
import type { AssistantMessage, Message } from 'src/types/message.js'
import { getEmptyToolPermissionContext } from '../Tool.js'
import { getModelBetas, modelSupportsStructuredOutputs } from './betas.js'
import { computeFingerprint } from './fingerprint.js'
import { createAssistantMessage, createUserMessage } from './messages.js'
import { normalizeModelStringForAPI } from './model/model.js'
import { asSystemPrompt } from './systemPromptType.js'
import type { ThinkingConfig } from './thinking.js'

type MessageParam = Anthropic.MessageParam
type TextBlockParam = Anthropic.TextBlockParam
type Tool = Anthropic.Tool
type ToolChoice = Anthropic.ToolChoice
type BetaMessage = Anthropic.Beta.Messages.BetaMessage
type BetaJSONOutputFormat = Anthropic.Beta.Messages.BetaJSONOutputFormat
type BetaThinkingConfigParam = Anthropic.Beta.Messages.BetaThinkingConfigParam

export type SideQueryOptions = {
  model: string
  system?: string | TextBlockParam[]
  messages: MessageParam[]
  tools?: Tool[] | BetaToolUnion[]
  tool_choice?: ToolChoice
  output_format?: BetaJSONOutputFormat
  max_tokens?: number
  maxRetries?: number
  signal?: AbortSignal
  skipSystemPromptPrefix?: boolean
  temperature?: number
  thinking?: number | false
  stop_sequences?: string[]
  querySource: QuerySource
}

function extractFirstUserMessageText(messages: MessageParam[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user')
  if (!firstUserMessage) return ''

  const content = firstUserMessage.content
  if (typeof content === 'string') return content

  const textBlock = content.find(block => block.type === 'text')
  return textBlock?.type === 'text' ? textBlock.text : ''
}

function buildSystemBlocks({
  system,
  skipSystemPromptPrefix,
  includeAttributionHeader,
  messages,
}: {
  system?: string | TextBlockParam[]
  skipSystemPromptPrefix?: boolean
  includeAttributionHeader: boolean
  messages: MessageParam[]
}): TextBlockParam[] {
  const messageText = extractFirstUserMessageText(messages)
  const fingerprint = includeAttributionHeader
    ? computeFingerprint(messageText, MACRO.VERSION)
    : undefined
  const attributionHeader = includeAttributionHeader
    ? getAttributionHeader(fingerprint)
    : undefined

  return [
    attributionHeader ? { type: 'text', text: attributionHeader } : null,
    ...(skipSystemPromptPrefix
      ? []
      : [
          {
            type: 'text' as const,
            text: getCLISyspromptPrefix({
              isNonInteractive: false,
              hasAppendSystemPrompt: false,
            }),
          },
        ]),
    ...(Array.isArray(system)
      ? system
      : system
        ? [{ type: 'text' as const, text: system }]
        : []),
  ].filter((block): block is TextBlockParam => block !== null)
}

function toThinkingConfig(
  thinking: SideQueryOptions['thinking'],
  maxTokens: number,
): ThinkingConfig {
  if (thinking === false || thinking === undefined) {
    return { type: 'disabled' }
  }

  return {
    type: 'enabled',
    budgetTokens: Math.min(thinking, maxTokens - 1),
  }
}

function toInternalMessages(messages: MessageParam[]): Message[] {
  return messages.map(message => {
    if (message.role === 'user') {
      return createUserMessage({
        content: message.content as Parameters<typeof createUserMessage>[0]['content'],
      })
    }

    if (message.role === 'assistant') {
      return createAssistantMessage({
        content: message.content as Parameters<typeof createAssistantMessage>[0]['content'],
      })
    }

    throw new Error(`Unsupported sideQuery message role: ${message.role}`)
  })
}

function toSideQueryResult(message: AssistantMessage): BetaMessage {
  const betaMessage = {
    ...message.message,
    content: message.message.content,
    usage: message.message.usage,
  } as BetaMessage & { _request_id?: string | null }

  if (message.requestId) {
    betaMessage._request_id = message.requestId
  }

  return betaMessage
}

function toProviderToolChoice(
  toolChoice: ToolChoice | undefined,
): Options['toolChoice'] {
  if (!toolChoice) {
    return undefined
  }

  if (toolChoice.type === 'auto') {
    return toolChoice
  }

  if (toolChoice.type === 'tool') {
    return toolChoice
  }

  return undefined
}

async function sideQueryViaProvider(
  opts: SideQueryOptions,
): Promise<BetaMessage> {
  const start = Date.now()
  const signal = opts.signal ?? new AbortController().signal
  const systemBlocks = buildSystemBlocks({
    system: opts.system,
    skipSystemPromptPrefix: opts.skipSystemPromptPrefix,
    includeAttributionHeader: false,
    messages: opts.messages,
  })
  const assistantMessage = await queryModelWithoutStreaming({
    messages: toInternalMessages(opts.messages),
    systemPrompt: asSystemPrompt(systemBlocks.map(block => block.text)),
    thinkingConfig: toThinkingConfig(opts.thinking, opts.max_tokens ?? 1024),
    tools: [],
    signal,
    options: {
      getToolPermissionContext: async () => getEmptyToolPermissionContext(),
      model: opts.model,
      toolChoice: toProviderToolChoice(opts.tool_choice),
      isNonInteractiveSession: false,
      extraToolSchemas: opts.tools as BetaToolUnion[] | undefined,
      maxOutputTokensOverride: opts.max_tokens ?? 1024,
      querySource: opts.querySource,
      agents: [],
      hasAppendSystemPrompt: false,
      temperatureOverride: opts.temperature,
      mcpTools: [],
      outputFormat: opts.output_format,
      stopSequences: opts.stop_sequences,
    },
  })

  const now = Date.now()
  const lastCompletion = getLastApiCompletionTimestamp()
  logEvent('tengu_api_success', {
    requestId:
      assistantMessage.requestId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    querySource:
      opts.querySource as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    model:
      opts.model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    inputTokens: assistantMessage.message.usage.input_tokens,
    outputTokens: assistantMessage.message.usage.output_tokens,
    cachedInputTokens: assistantMessage.message.usage.cache_read_input_tokens ?? 0,
    uncachedInputTokens:
      assistantMessage.message.usage.cache_creation_input_tokens ?? 0,
    durationMsIncludingRetries: now - start,
    timeSinceLastApiCallMs:
      lastCompletion !== null ? now - lastCompletion : undefined,
  })
  setLastApiCompletionTimestamp(now)

  return toSideQueryResult(assistantMessage)
}

async function sideQueryViaClaude(
  opts: SideQueryOptions,
): Promise<BetaMessage> {
  const {
    model,
    system,
    messages,
    tools,
    tool_choice,
    output_format,
    max_tokens = 1024,
    maxRetries = 2,
    signal,
    skipSystemPromptPrefix,
    temperature,
    thinking,
    stop_sequences,
  } = opts

  const client = await getAnthropicClient({
    maxRetries,
    model,
    source: 'side_query',
  })
  const betas = [...getModelBetas(model)]
  if (
    output_format &&
    modelSupportsStructuredOutputs(model) &&
    !betas.includes(STRUCTURED_OUTPUTS_BETA_HEADER)
  ) {
    betas.push(STRUCTURED_OUTPUTS_BETA_HEADER)
  }

  const systemBlocks = buildSystemBlocks({
    system,
    skipSystemPromptPrefix,
    includeAttributionHeader: true,
    messages,
  })

  let thinkingConfig: BetaThinkingConfigParam | undefined
  if (thinking === false) {
    thinkingConfig = { type: 'disabled' }
  } else if (thinking !== undefined) {
    thinkingConfig = {
      type: 'enabled',
      budget_tokens: Math.min(thinking, max_tokens - 1),
    }
  }

  const normalizedModel = normalizeModelStringForAPI(model)
  const start = Date.now()
  const response = await client.beta.messages.create(
    {
      model: normalizedModel,
      max_tokens,
      system: systemBlocks,
      messages,
      ...(tools && { tools }),
      ...(tool_choice && { tool_choice }),
      ...(output_format && { output_config: { format: output_format } }),
      ...(temperature !== undefined && { temperature }),
      ...(stop_sequences && { stop_sequences }),
      ...(thinkingConfig && { thinking: thinkingConfig }),
      ...(betas.length > 0 && { betas }),
      metadata: getAPIMetadata(),
    },
    { signal },
  )

  const requestId =
    (response as { _request_id?: string | null })._request_id ?? undefined
  const now = Date.now()
  const lastCompletion = getLastApiCompletionTimestamp()
  logEvent('tengu_api_success', {
    requestId:
      requestId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    querySource:
      opts.querySource as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    model:
      normalizedModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
    uncachedInputTokens: response.usage.cache_creation_input_tokens ?? 0,
    durationMsIncludingRetries: now - start,
    timeSinceLastApiCallMs:
      lastCompletion !== null ? now - lastCompletion : undefined,
  })
  setLastApiCompletionTimestamp(now)

  return response
}

export async function sideQuery(opts: SideQueryOptions): Promise<BetaMessage> {
  if (getProviderConfig().provider === 'claude') {
    return sideQueryViaClaude(opts)
  }

  return sideQueryViaProvider(opts)
}
