declare module 'semver' {
  export type SemVer = {
    version: string
    major?: number
    minor?: number
    patch?: number
  }

  export function coerce(version: string | null | undefined): SemVer | null
  export function major(
    version: string,
    options?: { loose?: boolean },
  ): number
  export function minor(
    version: string,
    options?: { loose?: boolean },
  ): number
  export function patch(
    version: string,
    options?: { loose?: boolean },
  ): number
  export function gt(
    a: string,
    b: string,
    options?: { loose?: boolean },
  ): boolean
  export function gte(
    a: string,
    b: string,
    options?: { loose?: boolean },
  ): boolean
  export function lt(
    a: string,
    b: string,
    options?: { loose?: boolean },
  ): boolean
  export function lte(
    a: string,
    b: string,
    options?: { loose?: boolean },
  ): boolean
  export function satisfies(
    version: string,
    range: string,
    options?: { loose?: boolean },
  ): boolean
  export function compare(
    a: string,
    b: string,
    options?: { loose?: boolean },
  ): -1 | 0 | 1
}

declare module 'tree-kill' {
  function treeKill(
    pid: number,
    signal?: string | number,
    callback?: (error?: Error | null) => void,
  ): void
  export default treeKill
}

declare module 'ignore' {
  export interface Ignore {
    add(patterns: string | readonly string[]): Ignore
    filter(paths: readonly string[]): string[]
    ignores(path: string): boolean
  }

  export default function ignore(): Ignore
}

declare module 'yaml' {
  export function parse(input: string): unknown
}

declare module 'execa' {
  export type StdioOption =
    | 'pipe'
    | 'ignore'
    | 'inherit'
    | [StdioOption, StdioOption, StdioOption]

  export type Options = {
    cwd?: string
    env?: NodeJS.ProcessEnv
    input?: string
    maxBuffer?: number
    reject?: boolean
    shell?: boolean | string
    signal?: AbortSignal
    stdin?: 'pipe' | 'ignore' | 'inherit'
    stderr?: 'pipe' | 'ignore' | 'inherit'
    stdout?: 'pipe' | 'ignore' | 'inherit'
    stdio?: StdioOption
    timeout?: number
  }

  export type ExecaReturnValue = {
    stdout: string
    stderr: string
    exitCode: number
    failed: boolean
    shortMessage?: string
    signal?: string
  }

  export type ExecaError = Error & {
    shortMessage?: string
    exitCode?: number
    stdout?: string
    stderr?: string
    signal?: string
  }

  export function execa(
    file: string,
    args?: readonly string[],
    options?: Options,
  ): Promise<ExecaReturnValue>

  export function execa(
    command: string,
    options?: Options,
  ): Promise<ExecaReturnValue>

  export function execaSync(
    file: string,
    argsOrOptions?: readonly string[] | Options,
    maybeOptions?: Options,
  ): ExecaReturnValue
}
