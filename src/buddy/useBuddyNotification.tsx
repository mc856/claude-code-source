import { feature } from 'bun:bundle'
import React, { useEffect } from 'react'
import { useNotifications } from '../context/notifications.js'
import { Text } from '../ink.js'
import { getGlobalConfig } from '../utils/config.js'
import { getRainbowColor } from '../utils/thinking.js'

// Local date, not UTC. Teaser window: April 1-7, 2026 only.
export function isBuddyTeaserWindow(): boolean {
  const d = new Date()
  return d.getFullYear() === 2026 && d.getMonth() === 3 && d.getDate() <= 7
}

export function isBuddyLive(): boolean {
  const d = new Date()
  return (
    d.getFullYear() > 2026 ||
    (d.getFullYear() === 2026 && d.getMonth() >= 3)
  )
}

function RainbowText({ text }: { text: string }): React.ReactNode {
  return (
    <>
      {[...text].map((ch, i) => (
        <Text key={i} color={getRainbowColor(i)}>
          {ch}
        </Text>
      ))}
    </>
  )
}

export function useBuddyNotification(): void {
  const { addNotification, removeNotification } = useNotifications()

  useEffect(() => {
    if (!feature('BUDDY')) return
    const config = getGlobalConfig()
    if (config.companion || !isBuddyTeaserWindow()) return

    addNotification({
      key: 'buddy-teaser',
      jsx: <RainbowText text="/buddy" />,
      priority: 'immediate',
      timeoutMs: 15_000,
    })

    return () => removeNotification('buddy-teaser')
  }, [addNotification, removeNotification])
}

export function findBuddyTriggerPositions(
  text: string,
): Array<{ start: number; end: number }> {
  if (!feature('BUDDY')) return []

  const triggers: Array<{ start: number; end: number }> = []
  const re = /\/buddy\b/g
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    triggers.push({
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  return triggers
}
