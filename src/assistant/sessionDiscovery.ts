export type AssistantSession = {
  sessionId: string
  label?: string
  status?: string
  [key: string]: unknown
}

export async function discoverAssistantSessions(): Promise<AssistantSession[]> {
  return []
}