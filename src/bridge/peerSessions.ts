export async function postInterClaudeMessage(
  _sessionId: string,
  _message: string,
): Promise<{ ok: boolean; error?: string }> {
  return {
    ok: false,
    error: 'Remote peer messaging is unavailable in this restored runtime',
  }
}