import type { Command } from '../commands.js'

const cache = new Map<string, Promise<Command[]>>()

async function fetchForClient(client: { name: string }): Promise<Command[]> {
  const cached = cache.get(client.name)
  if (cached) {
    return cached
  }

  const result = Promise.resolve([] as Command[])
  cache.set(client.name, result)
  return result
}

export const fetchMcpSkillsForClient = Object.assign(fetchForClient, { cache })