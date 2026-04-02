import { beforeEach, afterEach, describe, expect, it } from 'bun:test'
import { getMainLoopModelOverride, setMainLoopModelOverride } from '../../bootstrap/state.js'
import { getProviderConfig } from './config.js'
import { getProviderDiagnostics } from './diagnostics.js'
import { assertProviderConfigValid, validateProviderModelCombination } from './validate.js'
import { validateModel } from '../../utils/model/validateModel.js'

const savedEnv = { ...process.env }

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (key in savedEnv) {
      process.env[key] = savedEnv[key]
    } else {
      delete process.env[key]
    }
  }
  setMainLoopModelOverride(undefined)
}

beforeEach(() => {
  restoreEnv()
})

afterEach(() => {
  restoreEnv()
})

describe('provider selection and model compatibility', () => {
  it('rejects Claude aliases for OpenAI providers', async () => {
    process.env.CLAUDE_CODE_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_MODEL = 'gpt-4o'

    const config = getProviderConfig()
    expect(config.provider).toBe('openai')
    expect(validateProviderModelCombination(config, 'sonnet')).toHaveLength(1)

    const result = await validateModel('sonnet')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('Claude-specific')
    }
  })

  it('accepts provider-native OpenAI model names', async () => {
    process.env.CLAUDE_CODE_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_MODEL = 'gpt-4o'

    const result = await validateModel('gpt-4o')
    expect(result.valid).toBe(true)
  })

  it('validates the runtime model target in startup validation', () => {
    process.env.CLAUDE_CODE_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_MODEL = 'gpt-4o'

    expect(() =>
      assertProviderConfigValid(undefined, 'sonnet'),
    ).toThrow(/Claude-specific/)
  })

  it('shows the runtime model in diagnostics', () => {
    process.env.CLAUDE_CODE_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_MODEL = 'gpt-4o'
    setMainLoopModelOverride('gpt-4o')

    const diag = getProviderDiagnostics()
    expect(diag.provider).toBe('openai')
    expect(diag.resolvedModel).toBe('gpt-4o')
  })

  it('rejects incompatible direct model overrides', () => {
    process.env.CLAUDE_CODE_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_MODEL = 'gpt-4o'

    setMainLoopModelOverride('sonnet')
    expect(getMainLoopModelOverride()).toBeUndefined()
  })
})
