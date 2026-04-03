export type ShellProgress = {
  fullOutput?: string
  output?: string
  elapsedTimeSeconds?: number
  totalLines?: number
  totalBytes?: number
  timeoutMs?: number
  taskId?: string
  [key: string]: unknown
}

export type PowerShellProgress = ShellProgress

export type AgentToolProgress = {
  message?: {
    type?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type BashProgress = Record<string, unknown>
export type MCPProgress = Record<string, unknown>
export type REPLToolProgress = Record<string, unknown>
export type SkillToolProgress = Record<string, unknown>
export type TaskOutputProgress = Record<string, unknown>
export type WebSearchProgress = Record<string, unknown>
export type ToolProgressData =
  | ShellProgress
  | PowerShellProgress
  | AgentToolProgress
  | BashProgress
  | MCPProgress
  | REPLToolProgress
  | SkillToolProgress
  | TaskOutputProgress
  | WebSearchProgress
  | Record<string, unknown>

export type SdkWorkflowProgress = {
  type?: string
  index?: number
  phaseIndex?: number
  label?: string
  status?: string
  [key: string]: unknown
}
