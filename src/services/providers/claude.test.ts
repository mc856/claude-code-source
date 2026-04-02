import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { queryModelWithStreaming } from '../api/claude.js'
import { claudeAdapter } from './claude.js'
import { getProviderAdapter } from './registry.js'
import { getAPIProvider } from '../../utils/model/providers.js'

const savedEnv = { ...process.env }

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (key in savedEnv) {
      process.env[key] = savedEnv[key]
    } else {
      delete process.env[key]
    }
  }
}

beforeEach(() => {
  restoreEnv()
})

afterEach(() => {
  restoreEnv()
})

describe('Claude provider adapter', () => {
  it('preserves legacy Anthropic-compatible provider sub-path selection', () => {
    expect(getAPIProvider()).toBe('firstParty')
    expect(getProviderAdapter()).toBe(claudeAdapter)

    process.env.CLAUDE_CODE_USE_BEDROCK = '1'
    expect(getAPIProvider()).toBe('bedrock')
    expect(getProviderAdapter()).toBe(claudeAdapter)

    delete process.env.CLAUDE_CODE_USE_BEDROCK
    process.env.CLAUDE_CODE_USE_VERTEX = '1'
    expect(getAPIProvider()).toBe('vertex')
    expect(getProviderAdapter()).toBe(claudeAdapter)

    delete process.env.CLAUDE_CODE_USE_VERTEX
    process.env.CLAUDE_CODE_USE_FOUNDRY = '1'
    expect(getAPIProvider()).toBe('foundry')
    expect(getProviderAdapter()).toBe(claudeAdapter)
  })

  it('exposes Anthropic-only capabilities on the Claude adapter', () => {
    expect(claudeAdapter.capabilities.streaming).toBe(true)
    expect(claudeAdapter.capabilities.toolCalls).toBe(true)
    expect(claudeAdapter.capabilities.tokenEstimation).toBe(true)
    expect(claudeAdapter.capabilities.modelAliasResolution).toBe(true)
    expect(claudeAdapter.capabilities.remoteSession).toBe(true)
    expect(claudeAdapter.capabilities.oauthSession).toBe(true)
    expect(claudeAdapter.capabilities.bridgeSession).toBe(true)
  })

  it('delegates executeRequest directly to queryModelWithStreaming', () => {
    expect(claudeAdapter.executeRequest).toBe(queryModelWithStreaming)
  })
})
