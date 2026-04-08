export type CachedMCConfig = {
  enabled: boolean
  systemPromptSuggestSummaries: boolean
  supportedModels: string[]
  keepRecent: number
}

export function getCachedMCConfig(): CachedMCConfig {
  return {
    enabled: false,
    systemPromptSuggestSummaries: false,
    supportedModels: [],
    keepRecent: 0,
  }
}