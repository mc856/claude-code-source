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
