export type QueueOperation = 'enqueue' | 'dequeue' | 'clear' | 'requeue'

export type QueueOperationMessage = {
  type: 'queue-operation'
  operation: QueueOperation
  timestamp: string
  sessionId: string
  content?: string
}

export type MessageQueueEntry = QueueOperationMessage | Record<string, unknown>
