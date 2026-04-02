// Minimal runtime-safe shim for reconstructed source trees. The bundled CLI
// already contains the real assistant implementation.

let assistantForced = false

export function isAssistantMode(): boolean {
  return assistantForced
}

export function markAssistantForced(): void {
  assistantForced = true
}

export function isAssistantForced(): boolean {
  return assistantForced
}

export async function initializeAssistantTeam(): Promise<undefined> {
  return undefined
}

export function getAssistantSystemPromptAddendum(): string {
  return ''
}

export function getAssistantActivationPath(): string | undefined {
  return undefined
}
