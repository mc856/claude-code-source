declare const MACRO: {
  VERSION: string
  BUILD_TIME?: string
  PACKAGE_URL: string
  NATIVE_PACKAGE_URL?: string
}

declare module 'bun:bundle' {
  export function feature(name: string): boolean
}

declare module 'react/compiler-runtime' {
  export const c: any
}

declare module 'figures' {
  const figures: Record<string, string>
  export default figures
}

declare module 'fuse.js' {
  const Fuse: any
  export default Fuse
}

declare module 'p-map' {
  const pMap: any
  export default pMap
}

declare module 'qrcode' {
  export const toString: any
  const qrcode: {
    toString: any
  }
  export default qrcode
}

declare module 'ws' {
  const WebSocket: any
  export default WebSocket
}

declare module 'strip-ansi' {
  export default function stripAnsi(value: string): string
}

declare module '../services/compact/snipProjection.js' {
  export function isSnipBoundaryMessage(message: unknown): boolean
}

declare module '../services/compact/snipCompact.js' {
  export function isSnipMarkerMessage(message: unknown): boolean
}

declare module './messages/SnipBoundaryMessage.js' {
  import type * as React from 'react'
  export const SnipBoundaryMessage: React.ComponentType<{
    message: unknown
  }>
}

declare module '@anthropic-ai/claude-agent-sdk' {
  export type PermissionMode = string
}

declare module '@opentelemetry/sdk-metrics' {
  export class MeterProvider {}
}

declare module '@opentelemetry/sdk-trace-base' {
  export class BasicTracerProvider {}
}

declare module 'execa' {
  export function execa(
    command: string,
    options?: {
      shell?: boolean
      reject?: boolean
    },
  ): Promise<{
    exitCode: number
    stdout: string
    stderr: string
  }>
}

declare module '@commander-js/extra-typings' {
  export class Option {
    constructor(flags: string, description?: string)
    hideHelp(hidden?: boolean): this
  }

  export interface Command {
    command(nameAndArgs: string): Command
    description(text: string): Command
    option(flags: string, description?: string, defaultValue?: string): Command
    requiredOption(flags: string, description?: string): Command
    helpOption(flags: string, description?: string): Command
    addOption(option: Option): Command
    action(handler: (...args: any[]) => any): Command
  }
}
