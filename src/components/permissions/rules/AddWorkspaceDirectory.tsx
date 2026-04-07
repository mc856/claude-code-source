import figures from 'figures'
import * as React from 'react'
import { useEffect, useState } from 'react'
import { useDebounceCallback } from 'usehooks-ts'
import {
  addDirHelpMessage,
  validateDirectoryForWorkspace,
} from '../../../commands/add-dir/validation.js'
import TextInput from '../../../components/TextInput.js'
import type { KeyboardEvent } from '../../../ink/events/keyboard-event.js'
import { Box, Text } from '../../../ink.js'
import { useKeybinding } from '../../../keybindings/useKeybinding.js'
import type { ToolPermissionContext } from '../../../Tool.js'
import { getDirectoryCompletions } from '../../../utils/suggestions/directoryCompletion.js'
import { ConfigurableShortcutHint } from '../../ConfigurableShortcutHint.js'
import { Select } from '../../CustomSelect/select.js'
import { Byline } from '../../design-system/Byline.js'
import { Dialog } from '../../design-system/Dialog.js'
import { KeyboardShortcutHint } from '../../design-system/KeyboardShortcutHint.js'
import {
  PromptInputFooterSuggestions,
  type SuggestionItem,
} from '../../PromptInput/PromptInputFooterSuggestions.js'

type Props = {
  onAddDirectory: (path: string, remember?: boolean) => void
  onCancel: () => void
  permissionContext: ToolPermissionContext
  directoryPath?: string
}

type RememberDirectoryOption = 'yes-session' | 'yes-remember' | 'no'

const REMEMBER_DIRECTORY_OPTIONS: Array<{
  value: RememberDirectoryOption
  label: string
}> = [
  {
    value: 'yes-session',
    label: 'Yes, for this session',
  },
  {
    value: 'yes-remember',
    label: 'Yes, and remember this directory',
  },
  {
    value: 'no',
    label: 'No',
  },
]

type ExitGuideState = {
  pending: boolean
  keyName: string | null
}

function PermissionDescription(): React.ReactNode {
  return (
    <Text dimColor>
      Claude Code will be able to read files in this directory and make edits
      when auto-accept edits is on.
    </Text>
  )
}

function DirectoryDisplay({ path }: { path: string }): React.ReactNode {
  return (
    <Box flexDirection="column" paddingX={2} gap={1}>
      <Text color="permission">{path}</Text>
      <PermissionDescription />
    </Box>
  )
}

type DirectoryInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void | Promise<void>
  error: string | null
  suggestions: SuggestionItem[]
  selectedSuggestion: number
}

function noopCursorOffset(_cursorOffset: number): void {}

function DirectoryInput({
  value,
  onChange,
  onSubmit,
  error,
  suggestions,
  selectedSuggestion,
}: DirectoryInputProps): React.ReactNode {
  return (
    <Box flexDirection="column">
      <Text>Enter the path to the directory:</Text>
      <Box borderDimColor borderStyle="round" marginY={1} paddingLeft={1}>
        <TextInput
          showCursor
          placeholder={`Directory path${figures.ellipsis}`}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          columns={80}
          cursorOffset={value.length}
          onChangeCursorOffset={noopCursorOffset}
        />
      </Box>
      {suggestions.length > 0 && (
        <Box marginBottom={1}>
          <PromptInputFooterSuggestions
            suggestions={suggestions}
            selectedSuggestion={selectedSuggestion}
          />
        </Box>
      )}
      {error && <Text color="error">{error}</Text>}
    </Box>
  )
}

function renderExitGuide(exitState: ExitGuideState): React.ReactNode {
  return exitState.pending ? (
    <Text>Press {exitState.keyName} again to exit</Text>
  ) : (
    <Byline>
      <KeyboardShortcutHint shortcut="Tab" action="complete" />
      <KeyboardShortcutHint shortcut="Enter" action="add" />
      <ConfigurableShortcutHint
        action="confirm:no"
        context="Settings"
        fallback="Esc"
        description="cancel"
      />
    </Byline>
  )
}

export function AddWorkspaceDirectory({
  onAddDirectory,
  onCancel,
  permissionContext,
  directoryPath,
}: Props): React.ReactNode {
  const [directoryInput, setDirectoryInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)

  async function fetchSuggestions(path: string): Promise<void> {
    if (!path) {
      setSuggestions([])
      setSelectedSuggestion(0)
      return
    }

    const completions = await getDirectoryCompletions(path)
    setSuggestions(completions)
    setSelectedSuggestion(0)
  }

  const debouncedFetchSuggestions = useDebounceCallback(fetchSuggestions, 100)

  useEffect(() => {
    debouncedFetchSuggestions(directoryInput)
  }, [directoryInput, debouncedFetchSuggestions])

  function applySuggestion(suggestion: SuggestionItem): void {
    setDirectoryInput(`${suggestion.id}/`)
    setError(null)
  }

  async function handleSubmit(newPath: string): Promise<void> {
    const result = await validateDirectoryForWorkspace(
      newPath,
      permissionContext,
    )

    if (result.resultType === 'success') {
      onAddDirectory(result.absolutePath, false)
      return
    }

    setError(addDirHelpMessage(result))
  }

  useKeybinding('confirm:no', onCancel, { context: 'Settings' })

  function handleKeyDown(event: KeyboardEvent): void {
    if (suggestions.length === 0) {
      return
    }

    if (event.key === 'tab') {
      event.preventDefault()
      const suggestion = suggestions[selectedSuggestion]
      if (suggestion) {
        applySuggestion(suggestion)
      }
      return
    }

    if (event.key === 'return') {
      event.preventDefault()
      const suggestion = suggestions[selectedSuggestion]
      if (suggestion) {
        void handleSubmit(`${suggestion.id}/`)
      }
      return
    }

    if (event.key === 'up' || (event.ctrl && event.key === 'p')) {
      event.preventDefault()
      setSelectedSuggestion(previous =>
        previous <= 0 ? suggestions.length - 1 : previous - 1,
      )
      return
    }

    if (event.key === 'down' || (event.ctrl && event.key === 'n')) {
      event.preventDefault()
      setSelectedSuggestion(previous =>
        previous >= suggestions.length - 1 ? 0 : previous + 1,
      )
    }
  }

  function handleSelect(value: string): void {
    if (!directoryPath) {
      return
    }

    const selectionValue = value as RememberDirectoryOption
    switch (selectionValue) {
      case 'yes-session':
        onAddDirectory(directoryPath, false)
        return
      case 'yes-remember':
        onAddDirectory(directoryPath, true)
        return
      case 'no':
        onCancel()
    }
  }

  const inputGuide = directoryPath ? undefined : renderExitGuide

  return (
    <Box
      flexDirection="column"
      tabIndex={0}
      autoFocus
      onKeyDown={handleKeyDown}
    >
      <Dialog
        title="Add directory to workspace"
        onCancel={onCancel}
        color="permission"
        isCancelActive={false}
        inputGuide={inputGuide}
      >
        {directoryPath ? (
          <Box flexDirection="column" gap={1}>
            <DirectoryDisplay path={directoryPath} />
            <Select
              options={REMEMBER_DIRECTORY_OPTIONS}
              onChange={handleSelect}
              onCancel={() => handleSelect('no')}
            />
          </Box>
        ) : (
          <Box flexDirection="column" gap={1} marginX={2}>
            <PermissionDescription />
            <DirectoryInput
              value={directoryInput}
              onChange={setDirectoryInput}
              onSubmit={handleSubmit}
              error={error}
              suggestions={suggestions}
              selectedSuggestion={selectedSuggestion}
            />
          </Box>
        )}
      </Dialog>
    </Box>
  )
}
