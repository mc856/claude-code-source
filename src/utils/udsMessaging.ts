import { join } from 'path'
import { tmpdir } from 'os'

let socketPath = join(tmpdir(), 'claude-code-messaging.sock')
let onEnqueue: (() => void) | undefined

export function getDefaultUdsSocketPath(): string {
  return socketPath
}

export function getUdsMessagingSocketPath(): string {
  return socketPath
}

export async function startUdsMessaging(
  nextSocketPath: string,
  _options?: { isExplicit?: boolean },
): Promise<void> {
  socketPath = nextSocketPath
}

export function setOnEnqueue(callback: (() => void) | undefined): void {
  onEnqueue = callback
}

export function notifyUdsEnqueue(): void {
  onEnqueue?.()
}