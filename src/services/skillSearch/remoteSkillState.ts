export type DiscoveredRemoteSkill = {
  slug: string
  url: string
}

const discoveredRemoteSkills = new Map<string, DiscoveredRemoteSkill>()

export function stripCanonicalPrefix(name: string): string | null {
  const prefix = '_canonical_'
  return name.startsWith(prefix) ? name.slice(prefix.length) : null
}

export function getDiscoveredRemoteSkill(
  slug: string,
): DiscoveredRemoteSkill | undefined {
  return discoveredRemoteSkills.get(slug)
}

export function setDiscoveredRemoteSkill(skill: DiscoveredRemoteSkill): void {
  discoveredRemoteSkills.set(skill.slug, skill)
}

export function clearDiscoveredRemoteSkills(): void {
  discoveredRemoteSkills.clear()
}