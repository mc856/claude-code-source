import figures from 'figures'
import * as React from 'react'
import { useEffect } from 'react'
import { getOriginalCwd } from '../../../bootstrap/state.js'
import type { CommandResultDisplay } from '../../../commands.js'
import { Select } from '../../../components/CustomSelect/select.js'
import { Box, Text } from '../../../ink.js'
import type { ToolPermissionContext } from '../../../Tool.js'
import { useTabHeaderFocus } from '../../design-system/Tabs.js'

type Props = {
  onExit: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
  toolPermissionContext: ToolPermissionContext
  onRequestAddDirectory: () => void
  onRequestRemoveDirectory: (path: string) => void
  onHeaderFocusChange?: (focused: boolean) => void
}

type DirectoryItem = {
  path: string
  isCurrent: boolean
  isDeletable: boolean
}

function toDirectoryItem(path: string): DirectoryItem {
  return {
    path,
    isCurrent: false,
    isDeletable: true,
  }
}

function toOption(directory: DirectoryItem): { label: string; value: string } {
  return {
    label: directory.path,
    value: directory.path,
  }
}

export function WorkspaceTab({
  onExit,
  toolPermissionContext,
  onRequestAddDirectory,
  onRequestRemoveDirectory,
  onHeaderFocusChange,
}: Props): React.ReactNode {
  const { headerFocused, focusHeader } = useTabHeaderFocus()

  useEffect(() => {
    onHeaderFocusChange?.(headerFocused)
  }, [headerFocused, onHeaderFocusChange])

  const additionalDirectories = Array.from(
    toolPermissionContext.additionalWorkingDirectories.keys(),
  ).map(toDirectoryItem)

  function handleDirectorySelect(selectedValue: string): void {
    if (selectedValue === 'add-directory') {
      onRequestAddDirectory()
      return
    }

    const directory = additionalDirectories.find(
      item => item.path === selectedValue,
    )

    if (directory?.isDeletable) {
      onRequestRemoveDirectory(directory.path)
    }
  }

  function handleCancel(): void {
    onExit('Workspace dialog dismissed', { display: 'system' })
  }

  const options = additionalDirectories.map(toOption)
  options.push({
    label: `Add directory${figures.ellipsis}`,
    value: 'add-directory',
  })

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" marginTop={1} marginLeft={2} gap={1}>
        <Text>{`-  ${getOriginalCwd()}`}</Text>
        <Text dimColor>(Original working directory)</Text>
      </Box>
      <Select
        options={options}
        onChange={handleDirectorySelect}
        onCancel={handleCancel}
        visibleOptionCount={Math.min(10, options.length)}
        onUpFromFirstItem={focusHeader}
        isDisabled={headerFocused}
      />
    </Box>
  )
}
