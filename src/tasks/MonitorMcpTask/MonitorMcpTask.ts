import type { TaskStateBase } from '../../Task.js'

export type MonitorMcpTaskState = TaskStateBase & {
  type: 'monitor_mcp'
  pendingUserMessages?: string[]
  [key: string]: unknown
}

export function isMonitorMcpTask(
  value: unknown,
): value is MonitorMcpTaskState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'monitor_mcp'
  )
}
