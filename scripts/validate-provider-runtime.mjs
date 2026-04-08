import { spawnSync } from 'node:child_process'

import { setMainLoopModelOverride } from '../src/bootstrap/state.js'
import { getProviderConfig } from '../src/services/providers/config.js'
import { getProviderDiagnostics } from '../src/services/providers/diagnostics.js'
import {
  assertProviderConfigValid,
  getProviderConfigErrors,
  validateProviderModelCombination,
} from '../src/services/providers/validate.js'

const isWindows = process.platform === 'win32'
const PROMPT = 'Say OK only.'

let hasFailure = false

function cloneEnv() {
  return { ...process.env }
}

function restoreEnv(savedEnv) {
  for (const key of Object.keys(process.env)) {
    if (key in savedEnv) {
      process.env[key] = savedEnv[key]
    } else {
      delete process.env[key]
    }
  }
}

async function withProviderRuntime({ provider, env = {}, modelOverride, argvExtras = [] }, fn) {
  const savedEnv = cloneEnv()
  const savedArgv = [...process.argv]

  try {
    process.argv = [savedArgv[0], savedArgv[1], '--provider', provider, ...argvExtras]

    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    setMainLoopModelOverride(undefined)
    if (modelOverride !== undefined) {
      setMainLoopModelOverride(modelOverride)
    }

    return await fn()
  } finally {
    setMainLoopModelOverride(undefined)
    process.argv = savedArgv
    restoreEnv(savedEnv)
  }
}

async function runCheck(name, fn) {
  try {
    const detail = await fn()
    console.log(`[provider-runtime] ${name}: ok`)
    if (detail) {
      console.log(detail)
    }
  } catch (error) {
    hasFailure = true
    console.log(`[provider-runtime] ${name}: failed`)
    console.error(error instanceof Error ? error.message : String(error))
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertIncludes(haystack, needle, message) {
  assert(haystack.includes(needle), `${message} Expected to find "${needle}" in: ${haystack}`)
}

function runCommand(command, args, env) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    env: {
      ...process.env,
      ...env,
    },
  })
}

await runCheck('source version baseline', async () => {
  const result = runCommand(
    isWindows ? 'powershell.exe' : 'bun',
    isWindows
      ? ['-NoProfile', '-Command', 'bun run ./src/dev-entry.ts --version']
      : ['run', './src/dev-entry.ts', '--version'],
    {},
  )

  assert(result.status === 0, result.stderr || result.stdout || 'source version command failed')
  const versionLine = result.stdout.trim().split(/\r?\n/).at(-1)
  assert(versionLine, 'source version command produced no output')
  return versionLine
})

await runCheck('claude bare auth boundary', async () => {
  const env = {
    ANTHROPIC_API_KEY: undefined,
    ANTHROPIC_MODEL: 'sonnet',
    CLAUDE_CODE_PROVIDER: 'claude',
    OPENAI_API_KEY: undefined,
    OPENAI_MODEL: undefined,
    OPENAI_BASE_URL: undefined,
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_DEPLOYMENT: undefined,
    AZURE_OPENAI_API_VERSION: undefined,
    AZURE_OPENAI_API_KEY: undefined,
  }

  const result = runCommand(
    isWindows ? 'powershell.exe' : 'bun',
    isWindows
      ? ['-NoProfile', '-Command', `bun run ./src/dev-entry.ts --bare --provider claude -p \"${PROMPT}\"`]
      : ['run', './src/dev-entry.ts', '--bare', '--provider', 'claude', '-p', PROMPT],
    env,
  )

  const combined = [result.stdout, result.stderr].filter(Boolean).join('\n')
  assert(result.status !== 0, 'expected bare Claude validation to stop at the auth boundary')
  assertIncludes(combined, 'Not logged in', 'Claude bare validation did not surface the expected auth boundary.')
  return 'Expected bare-mode auth boundary observed.'
})

await runCheck('claude diagnostics snapshot', async () => {
  return withProviderRuntime(
    {
      provider: 'claude',
      env: {
        ANTHROPIC_API_KEY: undefined,
        ANTHROPIC_MODEL: 'sonnet',
      },
      modelOverride: 'sonnet',
    },
    async () => {
      const config = getProviderConfig()
      assert(config.provider === 'claude', `expected claude provider, got ${config.provider}`)
      const diag = getProviderDiagnostics()
      assert(diag.provider === 'claude', `expected claude diagnostics, got ${diag.provider}`)
      assert(diag.resolvedModel.length > 0, 'expected Claude diagnostics to include a resolved model')
      assert(diag.credentialSource.length > 0, 'expected Claude diagnostics to include credential source context')
      return `${diag.provider} | ${diag.resolvedModel} | ${diag.credentialSource}`
    },
  )
})

await runCheck('openai startup validation and diagnostics', async () => {
  return withProviderRuntime(
    {
      provider: 'openai',
      env: {
        OPENAI_API_KEY: 'test-openai-key',
        OPENAI_MODEL: 'gpt-4o',
        OPENAI_BASE_URL: 'https://api.openai.example.test',
        ANTHROPIC_API_KEY: undefined,
        ANTHROPIC_MODEL: undefined,
        AZURE_OPENAI_ENDPOINT: undefined,
        AZURE_OPENAI_DEPLOYMENT: undefined,
        AZURE_OPENAI_API_VERSION: undefined,
        AZURE_OPENAI_API_KEY: undefined,
      },
      modelOverride: 'gpt-4o',
    },
    async () => {
      const config = getProviderConfig()
      assert(config.provider === 'openai', `expected openai provider, got ${config.provider}`)
      assertProviderConfigValid(config, 'gpt-4o')

      const compatibilityErrors = validateProviderModelCombination(config, 'sonnet')
      assert(compatibilityErrors.length > 0, 'expected OpenAI provider to reject Claude-specific model aliases')

      const diag = getProviderDiagnostics()
      assert(diag.provider === 'openai', `expected openai diagnostics, got ${diag.provider}`)
      assert(diag.resolvedModel === 'gpt-4o', `expected OpenAI resolved model to be gpt-4o, got ${diag.resolvedModel}`)
      assertIncludes(diag.credentialSource, 'OPENAI_API_KEY', 'OpenAI diagnostics did not report API key credential state.')

      return `${diag.provider} | ${diag.resolvedModel} | ${diag.credentialSource}`
    },
  )
})

await runCheck('openai missing api key failure', async () => {
  return withProviderRuntime(
    {
      provider: 'openai',
      env: {
        OPENAI_API_KEY: undefined,
        OPENAI_MODEL: 'gpt-4o',
      },
      modelOverride: 'gpt-4o',
    },
    async () => {
      const config = getProviderConfig()
      assert(config.provider === 'openai', `expected openai provider, got ${config.provider}`)
      const errors = getProviderConfigErrors(config)
      assert(errors.length > 0, 'expected missing OpenAI API key to produce configuration errors')
      assertIncludes(errors.join('\n'), 'OPENAI_API_KEY', 'OpenAI validation error did not mention OPENAI_API_KEY.')
      return errors[0]
    },
  )
})

await runCheck('azure startup validation and diagnostics', async () => {
  return withProviderRuntime(
    {
      provider: 'azure-openai',
      env: {
        AZURE_OPENAI_ENDPOINT: 'https://example-resource.openai.azure.com',
        AZURE_OPENAI_DEPLOYMENT: 'gpt-4o-deployment',
        AZURE_OPENAI_API_VERSION: '2024-02-01',
        AZURE_OPENAI_API_KEY: 'test-azure-key',
        OPENAI_API_KEY: undefined,
        OPENAI_MODEL: undefined,
        ANTHROPIC_API_KEY: undefined,
        ANTHROPIC_MODEL: undefined,
      },
      modelOverride: 'gpt-4o-deployment',
    },
    async () => {
      const config = getProviderConfig()
      assert(config.provider === 'azure-openai', `expected azure-openai provider, got ${config.provider}`)
      assertProviderConfigValid(config, 'gpt-4o-deployment')

      const compatibilityErrors = validateProviderModelCombination(config, 'sonnet')
      assert(compatibilityErrors.length > 0, 'expected Azure OpenAI provider to reject Claude-specific model aliases')

      const diag = getProviderDiagnostics()
      assert(diag.provider === 'azure-openai', `expected azure-openai diagnostics, got ${diag.provider}`)
      assert(diag.resolvedModel === 'gpt-4o-deployment', `expected Azure resolved model to be gpt-4o-deployment, got ${diag.resolvedModel}`)
      assertIncludes(diag.credentialSource, 'AZURE_OPENAI_API_KEY', 'Azure diagnostics did not report credential source.')
      return `${diag.provider} | ${diag.resolvedModel} | ${diag.credentialSource}`
    },
  )
})

await runCheck('azure missing endpoint failure', async () => {
  return withProviderRuntime(
    {
      provider: 'azure-openai',
      env: {
        AZURE_OPENAI_ENDPOINT: undefined,
        AZURE_OPENAI_DEPLOYMENT: undefined,
        AZURE_OPENAI_API_VERSION: '2024-02-01',
        AZURE_OPENAI_API_KEY: undefined,
      },
      modelOverride: 'gpt-4o-deployment',
    },
    async () => {
      const config = getProviderConfig()
      assert(config.provider === 'azure-openai', `expected azure-openai provider, got ${config.provider}`)
      const errors = getProviderConfigErrors(config)
      const joined = errors.join('\n')
      assert(errors.length >= 2, 'expected Azure validation to report missing endpoint and deployment')
      assertIncludes(joined, 'AZURE_OPENAI_ENDPOINT', 'Azure validation error did not mention AZURE_OPENAI_ENDPOINT.')
      assertIncludes(joined, 'AZURE_OPENAI_DEPLOYMENT', 'Azure validation error did not mention AZURE_OPENAI_DEPLOYMENT.')
      return errors[0]
    },
  )
})

if (hasFailure) {
  process.exitCode = 1
}