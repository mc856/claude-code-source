import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { setMainLoopModelOverride } from '../../bootstrap/state.js'
import { authStatus } from './auth.js'

const savedEnv = { ...process.env }

class ExitCalled extends Error {
  constructor(public readonly code: number | undefined) {
    super(`process.exit(${code})`)
  }
}

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

describe('auth status output', () => {
  it('includes provider diagnostics for OpenAI and treats a valid config as logged in', async () => {
    process.env.CLAUDE_CODE_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_MODEL = 'gpt-4o'

    const writes: string[] = []
    const originalWrite = process.stdout.write.bind(process.stdout)
    const originalExit = process.exit

    process.stdout.write = ((chunk: unknown) => {
      writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString())
      return true
    }) as typeof process.stdout.write
    process.exit = ((code?: number) => {
      throw new ExitCalled(code)
    }) as typeof process.exit

    try {
      await authStatus({ json: true })
      expect.unreachable('authStatus should exit')
    } catch (error) {
      expect(error).toBeInstanceOf(ExitCalled)
      expect((error as ExitCalled).code).toBe(0)
    } finally {
      process.stdout.write = originalWrite
      process.exit = originalExit
    }

    const payload = JSON.parse(writes.join(''))
    expect(payload.provider).toBe('openai')
    expect(payload.loggedIn).toBe(true)
    expect(payload.authMethod).toBe('api_key')
    expect(payload.endpoint).toContain('api.openai.com')
    expect(payload.resolvedModel).toBe('gpt-4o')
    expect(payload.credentialSource).toContain('OPENAI_API_KEY')
  })
})
