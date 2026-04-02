type ConnectorTextBase = {
  type: 'connector_text'
  connector_text: string
  signature: string
  citations?: unknown[]
  [key: string]: unknown
}

export type ConnectorTextBlock = ConnectorTextBase

export type ConnectorTextDelta = {
  type: 'connector_text_delta'
  connector_text: string
  [key: string]: unknown
}

export function isConnectorTextBlock(
  value: unknown,
): value is ConnectorTextBlock {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    'connector_text' in value &&
    (value as { type?: unknown }).type === 'connector_text' &&
    typeof (value as { connector_text?: unknown }).connector_text === 'string'
  )
}
