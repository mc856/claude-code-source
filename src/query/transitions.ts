export type Continue = string
export type Terminal = void

export function transitionQueryState<T>(value: T): T {
  return value
}