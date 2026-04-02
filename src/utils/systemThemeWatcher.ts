import { oscColor, type TerminalQuerier } from '../ink/terminal-querier.js'
import {
  setCachedSystemTheme,
  themeFromOscColor,
  type SystemTheme,
} from './systemTheme.js'

export function watchSystemTheme(
  querier: TerminalQuerier,
  onTheme: (theme: SystemTheme) => void,
): () => void {
  let active = true

  const syncTheme = async () => {
    const response = await querier.send(oscColor(11))
    await querier.flush()
    if (!active || !response) return

    const nextTheme = themeFromOscColor(response.data)
    if (!nextTheme) return

    setCachedSystemTheme(nextTheme)
    onTheme(nextTheme)
  }

  void syncTheme()

  return () => {
    active = false
  }
}
