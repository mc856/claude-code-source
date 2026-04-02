import type { Tool } from '../../Tool.js'

// Minimal mirror-recovery stub.
// The real TungstenTool is only needed on ant-only paths; this keeps the
// mirrored source tree loadable for validation in non-ant environments.
export const TungstenTool = {
  name: 'tungsten',
  aliases: [],
  maxResultSizeChars: 0,
  async call() {
    throw new Error('TungstenTool is not available in this mirror build')
  },
  async description() {
    return 'TungstenTool'
  },
  async prompt() {
    return ''
  },
  get inputSchema() {
    return undefined
  },
  isEnabled() {
    return false
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  checkPermissions() {
    throw new Error('TungstenTool is not available in this mirror build')
  },
  userFacingName() {
    return 'TungstenTool'
  },
} as unknown as Tool
