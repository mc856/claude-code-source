export interface Transport {
  connect(): Promise<void>
  write(message: Record<string, unknown>): Promise<void>
  close(): void
  setOnData(handler: (data: string) => void): void
  setOnClose(handler: () => void): void
}
