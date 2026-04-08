import type { ModelProvider } from './types.js'

const ALL_PROVIDERS: ModelProvider[] = ['claude', 'openai', 'azure-openai']

function isTruthy(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function uniqueProviders(providers: ModelProvider[]): ModelProvider[] {
  return [...new Set(providers)]
}

export function isLiveSmokeEnabled(env: NodeJS.ProcessEnv): boolean {
  return isTruthy(env.CLAUDE_CODE_RUN_LIVE_PROVIDER_SMOKE)
}

export function parseRequestedLiveSmokeProviders(
  raw: string | undefined,
): ModelProvider[] {
  if (!raw) return []

  const normalized = raw.trim().toLowerCase()
  if (!normalized) return []
  if (normalized === 'all') return [...ALL_PROVIDERS]

  const providers = normalized
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .filter(
      (value): value is ModelProvider =>
        value === 'claude' || value === 'openai' || value === 'azure-openai',
    )

  return uniqueProviders(providers)
}

export function inferLiveSmokeProviders(
  env: NodeJS.ProcessEnv,
): ModelProvider[] {
  const providers: ModelProvider[] = []

  if (env.ANTHROPIC_API_KEY) {
    providers.push('claude')
  }
  if (env.OPENAI_API_KEY && env.OPENAI_MODEL) {
    providers.push('openai')
  }
  if (env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_DEPLOYMENT) {
    providers.push('azure-openai')
  }

  return uniqueProviders(providers)
}

export function getSelectedLiveSmokeProviders(
  env: NodeJS.ProcessEnv,
): ModelProvider[] {
  const requested = parseRequestedLiveSmokeProviders(
    env.CLAUDE_CODE_LIVE_SMOKE_PROVIDERS,
  )
  if (requested.length > 0) {
    return requested
  }
  return inferLiveSmokeProviders(env)
}

export function getLiveSmokeSkipReason(
  provider: ModelProvider,
  env: NodeJS.ProcessEnv,
): string | undefined {
  switch (provider) {
    case 'claude':
      return undefined
    case 'openai':
      if (!env.OPENAI_API_KEY) {
        return 'OPENAI_API_KEY is not set.'
      }
      if (!env.OPENAI_MODEL) {
        return 'OPENAI_MODEL is not set.'
      }
      return undefined
    case 'azure-openai':
      if (!env.AZURE_OPENAI_ENDPOINT) {
        return 'AZURE_OPENAI_ENDPOINT is not set.'
      }
      if (!env.AZURE_OPENAI_DEPLOYMENT) {
        return 'AZURE_OPENAI_DEPLOYMENT is not set.'
      }
      return undefined
  }
}

export function getLiveSmokeUsageSummary(
  env: NodeJS.ProcessEnv,
): { enabled: boolean; providers: ModelProvider[] } {
  return {
    enabled: isLiveSmokeEnabled(env),
    providers: getSelectedLiveSmokeProviders(env),
  }
}