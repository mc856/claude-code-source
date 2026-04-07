import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- 'r' is a view-specific key, not a global keybinding
import { Box, Text, useInput } from '../../../ink.js'
import {
  type AutoModeDenial,
  getAutoModeDenials,
} from '../../../utils/autoModeDenials.js'
import { Select } from '../../CustomSelect/select.js'
import { StatusIcon } from '../../design-system/StatusIcon.js'
import { useTabHeaderFocus } from '../../design-system/Tabs.js'

type Props = {
  onHeaderFocusChange?: (focused: boolean) => void
  onStateChange: (state: {
    approved: Set<number>
    retry: Set<number>
    denials: readonly AutoModeDenial[]
  }) => void
}

export function RecentDenialsTab({
  onHeaderFocusChange,
  onStateChange,
}: Props): React.ReactNode {
  const { headerFocused, focusHeader } = useTabHeaderFocus()

  useEffect(() => {
    onHeaderFocusChange?.(headerFocused)
  }, [headerFocused, onHeaderFocusChange])

  // Snapshot on mount. The live denial store prepends entries, so using
  // stable indexes avoids mid-edit shifts while the dialog is open.
  const [denials] = useState<readonly AutoModeDenial[]>(() =>
    getAutoModeDenials(),
  )
  const [approved, setApproved] = useState<Set<number>>(() => new Set())
  const [retry, setRetry] = useState<Set<number>>(() => new Set())
  const [focusedIdx, setFocusedIdx] = useState(0)

  useEffect(() => {
    onStateChange({ approved, retry, denials })
  }, [approved, retry, denials, onStateChange])

  const handleSelect = useCallback((value: string) => {
    const idx = Number(value)
    setApproved(prev => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }, [])

  const handleFocus = useCallback((value: string) => {
    setFocusedIdx(Number(value))
  }, [])

  useInput(
    input => {
      if (input !== 'r') {
        return
      }

      setRetry(prev => {
        const next = new Set(prev)
        if (next.has(focusedIdx)) {
          next.delete(focusedIdx)
        } else {
          next.add(focusedIdx)
        }
        return next
      })

      // Retry implies approve.
      setApproved(prev => {
        if (prev.has(focusedIdx)) {
          return prev
        }
        const next = new Set(prev)
        next.add(focusedIdx)
        return next
      })
    },
    { isActive: denials.length > 0 },
  )

  if (denials.length === 0) {
    return (
      <Text dimColor>
        No recent denials. Commands denied by the auto mode classifier will
        appear here.
      </Text>
    )
  }

  const options = denials.map((denial, idx) => {
    const isApproved = approved.has(idx)
    const suffix = retry.has(idx) ? ' (retry)' : ''

    return {
      label: (
        <Text>
          <StatusIcon
            status={isApproved ? 'success' : 'error'}
            withSpace
          />
          {denial.display}
          <Text dimColor>{suffix}</Text>
        </Text>
      ),
      value: String(idx),
    }
  })

  return (
    <Box flexDirection="column">
      <Text>Commands recently denied by the auto mode classifier.</Text>
      <Box marginTop={1}>
        <Select
          options={options}
          onChange={handleSelect}
          onFocus={handleFocus}
          visibleOptionCount={Math.min(10, options.length)}
          isDisabled={headerFocused}
          onUpFromFirstItem={focusHeader}
        />
      </Box>
    </Box>
  )
}
