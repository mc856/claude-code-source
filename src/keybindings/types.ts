export type KeybindingAction = string

export type KeybindingContextName =
  | 'Global'
  | 'Chat'
  | 'Autocomplete'
  | 'Confirmation'
  | 'Help'
  | 'Transcript'
  | 'HistorySearch'
  | 'Task'
  | 'ThemePicker'
  | 'Settings'
  | 'Tabs'
  | 'Attachments'
  | 'Footer'
  | 'MessageSelector'
  | 'DiffDialog'
  | 'ModelPicker'
  | 'Select'
  | 'Plugin'

export type ParsedKeystroke = {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  [key: string]: unknown
}

export type ParsedBinding = {
  action: KeybindingAction
  context: KeybindingContextName
  keystrokes: ParsedKeystroke[]
  description?: string
  source?: string
  [key: string]: unknown
}

export type KeybindingBlock = {
  context: KeybindingContextName
  bindings: Record<string, string | string[]>
  [key: string]: unknown
}
