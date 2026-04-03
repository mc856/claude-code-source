export type FileSuggestion = Record<string, unknown>
export type FileSuggestionCommandInput = {
  query?: string
  cwd?: string
  [key: string]: unknown
}
