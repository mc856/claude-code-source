import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'

const checks = [
  {
    name: 'source version',
    command: isWindows ? 'powershell.exe' : 'bun',
    args: isWindows
      ? ['-NoProfile', '-Command', 'bun src/entrypoints/cli.tsx --version']
      : ['src/entrypoints/cli.tsx', '--version'],
  },
  {
    name: 'source help',
    command: isWindows ? 'powershell.exe' : 'bun',
    args: isWindows
      ? ['-NoProfile', '-Command', 'bun src/entrypoints/cli.tsx --help']
      : ['src/entrypoints/cli.tsx', '--help'],
  },
  {
    name: 'prebuilt version',
    command: process.execPath,
    args: ['cli.js', '--version'],
  },
]

let hasFailure = false

for (const check of checks) {
  const result = spawnSync(check.command, check.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  })

  const header = `[restoration] ${check.name}: ${result.status === 0 ? 'ok' : 'failed'}`
  console.log(header)

  if (result.stdout?.trim()) {
    console.log(result.stdout.trim())
  }

  if (result.stderr?.trim()) {
    console.error(result.stderr.trim())
  }

  if (result.error) {
    console.error(result.error.message)
  }

  if (result.status !== 0) {
    hasFailure = true
  }
}

if (hasFailure) {
  process.exitCode = 1
}
