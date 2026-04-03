export type StatusLineItem = Record<string, unknown>
export type StatusLineCommandInput = {
  text?: string
  style?: string
  [key: string]: unknown
}
