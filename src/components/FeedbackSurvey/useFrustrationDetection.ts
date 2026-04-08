export function useFrustrationDetection(): {
  state: string
  handleTranscriptSelect: () => void
} {
  return {
    state: 'closed',
    handleTranscriptSelect() {},
  }
}