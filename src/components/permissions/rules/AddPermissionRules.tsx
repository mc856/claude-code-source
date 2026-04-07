import * as React from 'react'
import { Select } from '../../../components/CustomSelect/select.js'
import { Box, Text } from '../../../ink.js'
import type { ToolPermissionContext } from '../../../Tool.js'
import type {
  PermissionBehavior,
  PermissionRule,
  PermissionRuleValue,
} from '../../../utils/permissions/PermissionRule.js'
import {
  applyPermissionUpdate,
  persistPermissionUpdate,
} from '../../../utils/permissions/PermissionUpdate.js'
import { permissionRuleValueToString } from '../../../utils/permissions/permissionRuleParser.js'
import {
  detectUnreachableRules,
  type UnreachableRule,
} from '../../../utils/permissions/shadowedRuleDetection.js'
import { SandboxManager } from '../../../utils/sandbox/sandbox-adapter.js'
import {
  type EditableSettingSource,
  SOURCES,
} from '../../../utils/settings/constants.js'
import { getRelativeSettingsFilePathForSource } from '../../../utils/settings/settings.js'
import { plural } from '../../../utils/stringUtils.js'
import type { OptionWithDescription } from '../../CustomSelect/select.js'
import { Dialog } from '../../design-system/Dialog.js'
import { PermissionRuleDescription } from './PermissionRuleDescription.js'

export function optionForPermissionSaveDestination(
  saveDestination: EditableSettingSource,
): OptionWithDescription {
  switch (saveDestination) {
    case 'localSettings':
      return {
        label: 'Project settings (local)',
        description: `Saved in ${getRelativeSettingsFilePathForSource('localSettings')}`,
        value: saveDestination,
      }
    case 'projectSettings':
      return {
        label: 'Project settings',
        description: `Checked in at ${getRelativeSettingsFilePathForSource('projectSettings')}`,
        value: saveDestination,
      }
    case 'userSettings':
      return {
        label: 'User settings',
        description: 'Saved in at ~/.claude/settings.json',
        value: saveDestination,
      }
  }
}

type Props = {
  onAddRules: (rules: PermissionRule[], unreachable?: UnreachableRule[]) => void
  onCancel: () => void
  ruleValues: PermissionRuleValue[]
  ruleBehavior: PermissionBehavior
  initialContext: ToolPermissionContext
  setToolPermissionContext: (newContext: ToolPermissionContext) => void
}

function renderRuleValue(ruleValue: PermissionRuleValue): React.ReactNode {
  return (
    <Box
      flexDirection="column"
      key={permissionRuleValueToString(ruleValue)}
    >
      <Text bold>{permissionRuleValueToString(ruleValue)}</Text>
      <PermissionRuleDescription ruleValue={ruleValue} />
    </Box>
  )
}

export function AddPermissionRules({
  onAddRules,
  onCancel,
  ruleValues,
  ruleBehavior,
  initialContext,
  setToolPermissionContext,
}: Props): React.ReactNode {
  const allOptions = SOURCES.map(optionForPermissionSaveDestination)

  function handleSelect(selectedValue: string): void {
    if (selectedValue === 'cancel') {
      onCancel()
      return
    }

    if (!(SOURCES as readonly string[]).includes(selectedValue)) {
      return
    }

    const destination = selectedValue as EditableSettingSource
    const update = {
      type: 'addRules' as const,
      rules: ruleValues,
      behavior: ruleBehavior,
      destination,
    }

    const updatedContext = applyPermissionUpdate(initialContext, update)
    persistPermissionUpdate(update)
    setToolPermissionContext(updatedContext)

    const rules: PermissionRule[] = ruleValues.map(ruleValue => ({
      ruleValue,
      ruleBehavior,
      source: destination,
    }))

    const sandboxAutoAllowEnabled =
      SandboxManager.isSandboxingEnabled() &&
      SandboxManager.isAutoAllowBashIfSandboxedEnabled()
    const allUnreachable = detectUnreachableRules(updatedContext, {
      sandboxAutoAllowEnabled,
    })
    const newUnreachable = allUnreachable.filter(unreachableRule =>
      ruleValues.some(
        ruleValue =>
          ruleValue.toolName === unreachableRule.rule.ruleValue.toolName &&
          ruleValue.ruleContent === unreachableRule.rule.ruleValue.ruleContent,
      ),
    )

    onAddRules(
      rules,
      newUnreachable.length > 0 ? newUnreachable : undefined,
    )
  }

  const title = `Add ${ruleBehavior} permission ${plural(ruleValues.length, 'rule')}`
  const prompt =
    ruleValues.length === 1
      ? 'Where should this rule be saved?'
      : 'Where should these rules be saved?'

  return (
    <Dialog title={title} onCancel={onCancel} color="permission">
      <Box flexDirection="column" paddingX={2}>
        {ruleValues.map(renderRuleValue)}
      </Box>

      <Box flexDirection="column" marginY={1}>
        <Text>{prompt}</Text>
        <Select options={allOptions} onChange={handleSelect} />
      </Box>
    </Dialog>
  )
}
