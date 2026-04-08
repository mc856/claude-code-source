export type LiveSession = {
  sessionId?: string
  kind?: string
}

export async function sendToUdsSocket(
  _socketPath: string,
  _message: string,
): Promise<void> {
  throw new Error('UDS messaging is unavailable in this restored runtime')
}

export async function listAllLiveSessions(): Promise<LiveSession[]> {
  return []
}