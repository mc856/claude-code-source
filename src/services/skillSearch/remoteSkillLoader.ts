export type RemoteSkillLoadResult = {
  cacheHit: boolean
  latencyMs: number
  skillPath: string
  content: string
  fileCount: number
  totalBytes: number
  fetchMethod: string
}

export async function loadRemoteSkill(
  slug: string,
  _url: string,
): Promise<RemoteSkillLoadResult> {
  const content = `# ${slug}\n\nRemote skill loading is unavailable in this restored runtime.`
  return {
    cacheHit: false,
    latencyMs: 0,
    skillPath: `${slug}/SKILL.md`,
    content,
    fileCount: 1,
    totalBytes: content.length,
    fetchMethod: 'stub',
  }
}