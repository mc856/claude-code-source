import * as React from 'react'
import { Select } from '../../../components/CustomSelect/select.js'
import { Box, Text } from '../../../ink.js'
import type { ToolPermissionContext } from '../../../Tool.js'
import { applyPermissionUpdate } from '../../../utils/permissions/PermissionUpdate.js'
import { Dialog } from '../../design-system/Dialog.js'

type Props = {
  directoryPath: string
  onRemove: () => void
  onCancel: () => void
  permissionContext: ToolPermissionContext
  setPermissionContext: (context: ToolPermissionContext) => void
}

export function RemoveWorkspaceDirectory({
  directoryPath,
  onRemove,
  onCancel,
  permissionContext,
  setPermissionContext,
}: Props): React.ReactNode {
  function handleRemove(): void {
    const updatedContext = applyPermissionUpdate(permissionContext, {
      type: 'removeDirectories',
      directories: [directoryPath],
      destination: 'session',
    })

    setPermissionContext(updatedContext)
    onRemove()
  }

  function handleSelect(value: string): void {
    if (value === 'yes') {
      handleRemove()
      return
    }

    onCancel()
  }

  return (
    <Dialog
      title="Remove directory from workspace?"
      onCancel={onCancel}
      color="error"
    >
      <Box marginX={2} flexDirection="column">
        <Text bold>{directoryPath}</Text>
      </Box>
      <Text>
        Claude Code will no longer have access to files in this directory.
      </Text>
      <Select
        onChange={handleSelect}
        onCancel={onCancel}
        options={[
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ]}
      />
    </Dialog>
  )
}
