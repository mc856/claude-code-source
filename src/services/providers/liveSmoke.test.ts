import { describe, expect, it } from 'bun:test'

import {
  getLiveSmokeSkipReason,
  getSelectedLiveSmokeProviders,
  inferLiveSmokeProviders,
  isLiveSmokeEnabled,
  parseRequestedLiveSmokeProviders,
} from './liveSmoke.js'

describe('provider live smoke helpers', () => {
  it('treats live smoke as disabled by default', () => {
    expect(isLiveSmokeEnabled({})).toBe(false)
    expect(isLiveSmokeEnabled({ CLAUDE_CODE_RUN_LIVE_PROVIDER_SMOKE: '1' })).toBe(true)
  })

  it('parses explicit provider requests and deduplicates them', () => {
    expect(parseRequestedLiveSmokeProviders('openai,azure-openai,openai')).toEqual([
      'openai',
      'azure-openai',
    ])
    expect(parseRequestedLiveSmokeProviders('all')).toEqual([
      'claude',
      'openai',
      'azure-openai',
    ])
  })

  it('infers providers from configured live credentials', () => {
    expect(
      inferLiveSmokeProviders({
        OPENAI_API_KEY: 'key',
        OPENAI_MODEL: 'gpt-4o',
        AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com',
        AZURE_OPENAI_DEPLOYMENT: 'dep',
      }),
    ).toEqual(['openai', 'azure-openai'])
  })

  it('prefers explicit provider selection over inferred providers', () => {
    expect(
      getSelectedLiveSmokeProviders({
        CLAUDE_CODE_LIVE_SMOKE_PROVIDERS: 'claude',
        OPENAI_API_KEY: 'key',
        OPENAI_MODEL: 'gpt-4o',
      }),
    ).toEqual(['claude'])
  })

  it('reports provider-specific skip reasons for missing live configuration', () => {
    expect(getLiveSmokeSkipReason('claude', {})).toBeUndefined()
    expect(getLiveSmokeSkipReason('openai', {})).toContain('OPENAI_API_KEY')
    expect(
      getLiveSmokeSkipReason('azure-openai', {
        AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com',
      }),
    ).toContain('AZURE_OPENAI_DEPLOYMENT')
  })
})