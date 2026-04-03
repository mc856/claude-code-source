import { readFileSync } from 'fs'

type MacroShape = {
  VERSION: string
  BUILD_TIME?: string
  PACKAGE_URL: string
  NATIVE_PACKAGE_URL?: string
  FEEDBACK_CHANNEL?: string
  VERSION_CHANGELOG?: string
}

type PackageJsonShape = {
  name?: string
  version?: string
}

function loadPackageMetadata(): PackageJsonShape {
  try {
    const packageJsonPath = new URL('../../package.json', import.meta.url)
    return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJsonShape
  } catch {
    return {}
  }
}

export function ensureSourceRuntimeCompat(): void {
  const globalWithMacro = globalThis as typeof globalThis & {
    MACRO?: MacroShape
  }

  if (globalWithMacro.MACRO) {
    return
  }

  const packageJson = loadPackageMetadata()
  const packageName = packageJson.name || '@anthropic-ai/claude-code'
  const packageVersion = packageJson.version || '0.0.0-source'

  globalWithMacro.MACRO = {
    VERSION: packageVersion,
    PACKAGE_URL: packageName,
    BUILD_TIME: 'source-runtime',
    FEEDBACK_CHANNEL: 'support',
  }
}

ensureSourceRuntimeCompat()
