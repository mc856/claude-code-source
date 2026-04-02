export type AnyZodRawShape = Record<string, unknown>

export type InferShape<Schema extends AnyZodRawShape> = {
  [Key in keyof Schema]: unknown
}

export type SdkMcpToolDefinition<
  Schema extends AnyZodRawShape = AnyZodRawShape,
> = {
  name: string
  description: string
  inputSchema: Schema
  [key: string]: unknown
}

export type McpSdkServerConfigWithInstance = {
  [key: string]: unknown
}

export type Query = Promise<unknown>
export type InternalQuery = Query

export type Options = Record<string, unknown>
export type InternalOptions = Options

export type SDKSession = Record<string, unknown>
export type SDKSessionOptions = Record<string, unknown>

export type ForkSessionOptions = Record<string, unknown>
export type ForkSessionResult = Record<string, unknown>
export type GetSessionMessagesOptions = Record<string, unknown>
export type GetSessionInfoOptions = Record<string, unknown>
export type ListSessionsOptions = Record<string, unknown>
export type SessionMutationOptions = Record<string, unknown>
export type SessionMessage = Record<string, unknown>
