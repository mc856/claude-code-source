let active = false
let paused = false

export function isProactiveActive(): boolean {
  return active
}

export function isProactivePaused(): boolean {
  return paused
}

export function activateProactive(_source?: string): void {
  active = true
  paused = false
}

export function deactivateProactive(): void {
  active = false
  paused = false
}

const proactiveIndex = {
  isProactiveActive,
  isProactivePaused,
  activateProactive,
  deactivateProactive,
}

export default proactiveIndex
