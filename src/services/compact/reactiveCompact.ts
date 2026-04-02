export async function maybeReactiveCompact<T>(value?: T): Promise<T | undefined> {
  return value
}

export function isWithheldPromptTooLong(): boolean {
  return false
}

export function isReactiveOnlyMode(): boolean {
  return false
}

export async function reactiveCompactOnPromptTooLong(
  ..._args: unknown[]
): Promise<any> {
  return { ok: false, reason: 'too_few_groups' }
}
