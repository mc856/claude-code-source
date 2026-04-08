import { spawnSync } from 'node:child_process'

import {
  getLiveSmokeSkipReason,
  getSelectedLiveSmokeProviders,
  getLiveSmokeUsageSummary,
  isLiveSmokeEnabled,
} from '../src/services/providers/liveSmoke.ts'

const isWindows = process.platform === 'win32'
const PROMPT = 'Say OK only.'

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

function buildProviderCommand(provider) {
  if (isWindows) {
    return {
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-Command',
        `bun run ./src/dev-entry.ts --provider ${provider} -p \"${PROMPT}\"`,
      ],
    }
  }

  return {
    command: 'bun',
    args: ['run', './src/dev-entry.ts', '--provider', provider, '-p', PROMPT],
  }
}

function printSkip(provider, reason) {
  console.log(`[provider-live-smoke] ${provider}: skipped`)
  console.log(reason)
}

if (!isLiveSmokeEnabled(process.env)) {
  console.log('[provider-live-smoke] skipped: live smoke is disabled')
  console.log('Set CLAUDE_CODE_RUN_LIVE_PROVIDER_SMOKE=1 to enable real provider-backed prompt checks.')
  process.exit(0)
}

const summary = getLiveSmokeUsageSummary(process.env)
if (summary.providers.length === 0) {
  console.log('[provider-live-smoke] skipped: no providers selected')
  console.log('Set CLAUDE_CODE_LIVE_SMOKE_PROVIDERS or provide live provider configuration to infer providers.')
  process.exit(0)
}

let attempted = 0
let failed = 0

for (const provider of summary.providers) {
  const skipReason = getLiveSmokeSkipReason(provider, process.env)
  if (skipReason) {
    printSkip(provider, skipReason)
    continue
  }

  attempted += 1
  const { command, args } = buildProviderCommand(provider)
  const result = runCommand(command, args, process.env)
  const stdout = result.stdout?.trim() ?? ''
  const stderr = result.stderr?.trim() ?? ''

  if (result.status === 0 && stdout === 'OK') {
    console.log(`[provider-live-smoke] ${provider}: ok`)
    console.log(stdout)
    continue
  }

  failed += 1
  console.log(`[provider-live-smoke] ${provider}: failed`)
  if (stdout) {
    console.log(stdout)
  }
  if (stderr) {
    console.error(stderr)
  }
  if (result.error) {
    console.error(result.error.message)
  }
}

if (attempted === 0) {
  console.log('[provider-live-smoke] no live provider attempts were made')
  process.exit(0)
}

if (failed > 0) {
  process.exitCode = 1
}