type SkillDiscoveryAttachment = unknown

export type SkillDiscoveryPrefetch = Promise<SkillDiscoveryAttachment[]>

export function startSkillDiscoveryPrefetch(): SkillDiscoveryPrefetch {
  return Promise.resolve([])
}

export async function collectSkillDiscoveryPrefetch(
  pending: SkillDiscoveryPrefetch,
): Promise<SkillDiscoveryAttachment[]> {
  return pending
}