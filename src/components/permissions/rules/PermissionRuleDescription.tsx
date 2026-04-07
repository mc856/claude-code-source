import * as React from 'react'
import { Text } from '../../../ink.js'
import { BashTool } from '../../../tools/BashTool/BashTool.js'
import type { PermissionRuleValue } from '../../../utils/permissions/PermissionRule.js'

type RuleSubtitleProps = {
  ruleValue: PermissionRuleValue
}

export function PermissionRuleDescription({
  ruleValue,
}: RuleSubtitleProps): React.ReactNode {
  if (ruleValue.toolName === BashTool.name) {
    if (!ruleValue.ruleContent) {
      return <Text dimColor>Any Bash command</Text>
    }

    if (ruleValue.ruleContent.endsWith(':*')) {
      return (
        <Text dimColor>
          Any Bash command starting with{' '}
          <Text bold>{ruleValue.ruleContent.slice(0, -2)}</Text>
        </Text>
      )
    }

    return (
      <Text dimColor>
        The Bash command <Text bold>{ruleValue.ruleContent}</Text>
      </Text>
    )
  }

  if (!ruleValue.ruleContent) {
    return (
      <Text dimColor>
        Any use of the <Text bold>{ruleValue.toolName}</Text> tool
      </Text>
    )
  }

  return null
}
