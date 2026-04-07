import chalk from 'chalk'
import figures from 'figures'
import * as React from 'react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAppState, useSetAppState } from 'src/state/AppState.js'
import {
  applyPermissionUpdate,
  persistPermissionUpdate,
} from 'src/utils/permissions/PermissionUpdate.js'
import type { PermissionUpdateDestination } from 'src/utils/permissions/PermissionUpdateSchema.js'
import type { CommandResultDisplay } from '../../../commands.js'
import { Select } from '../../../components/CustomSelect/select.js'
import { useExitOnCtrlCDWithKeybindings } from '../../../hooks/useExitOnCtrlCDWithKeybindings.js'
import { useSearchInput } from '../../../hooks/useSearchInput.js'
import type { KeyboardEvent } from '../../../ink/events/keyboard-event.js'
import { Box, Text, useTerminalFocus } from '../../../ink.js'
import { useKeybinding } from '../../../keybindings/useKeybinding.js'
import { getAutoModeDenials } from '../../../utils/autoModeDenials.js'
import type {
  PermissionBehavior,
  PermissionRule,
  PermissionRuleValue,
} from '../../../utils/permissions/PermissionRule.js'
import { permissionRuleValueToString } from '../../../utils/permissions/permissionRuleParser.js'
import {
  deletePermissionRule,
  getAllowRules,
  getAskRules,
  getDenyRules,
  permissionRuleSourceDisplayString,
} from '../../../utils/permissions/permissions.js'
import type { UnreachableRule } from '../../../utils/permissions/shadowedRuleDetection.js'
import { jsonStringify } from '../../../utils/slowOperations.js'
import type { ToolPermissionContext } from '../../../Tool.js'
import { Pane } from '../../design-system/Pane.js'
import {
  Tab,
  Tabs,
  useTabHeaderFocus,
  useTabsWidth,
} from '../../design-system/Tabs.js'
import { SearchBox } from '../../SearchBox.js'
import type { Option } from '../../ui/option.js'
import { AddPermissionRules } from './AddPermissionRules.js'
import { AddWorkspaceDirectory } from './AddWorkspaceDirectory.js'
import { PermissionRuleDescription } from './PermissionRuleDescription.js'
import { PermissionRuleInput } from './PermissionRuleInput.js'
import { RecentDenialsTab } from './RecentDenialsTab.js'
import { RemoveWorkspaceDirectory } from './RemoveWorkspaceDirectory.js'
import { WorkspaceTab } from './WorkspaceTab.js'

type TabType = 'recent' | 'allow' | 'ask' | 'deny' | 'workspace'
type RuleTab = Extract<TabType, PermissionBehavior>

type Props = {
  onExit: (
    result?: string,
    options?: {
      display?: CommandResultDisplay
      shouldQuery?: boolean
      metaMessages?: string[]
    },
  ) => void
  initialTab?: TabType
  onRetryDenials?: (commands: string[]) => void
}

type RuleSourceTextProps = {
  rule: PermissionRule
}

type RuleDetailsProps = {
  rule: PermissionRule
  onDelete: () => void
  onCancel: () => void
}

type RulesByKey = Map<string, PermissionRule>

type RulesLookupResult = {
  options: Option[]
  rulesByKey: RulesByKey
}

type RulesTabContentProps = {
  options: Option[]
  searchQuery: string
  isSearchMode: boolean
  isFocused: boolean
  onSelect: (value: string) => void
  onCancel: () => void
  lastFocusedRuleKey?: string
  cursorOffset?: number
  onHeaderFocusChange?: (focused: boolean) => void
}

type PermissionRulesTabProps = Omit<RulesTabContentProps, 'options' | 'onSelect'> & {
  tab: RuleTab
  getRulesOptions: (tab: TabType, query?: string) => RulesLookupResult
  handleToolSelect: (value: string, tab: RuleTab) => void
}

type ValidatedRuleState = {
  ruleValue: PermissionRuleValue
  ruleBehavior: RuleTab
}

type DenialState = {
  approved: Set<number>
  retry: Set<number>
  denials: readonly { display: string }[]
}

function RuleSourceText({ rule }: RuleSourceTextProps): React.ReactNode {
  return (
    <Text dimColor>{`From ${permissionRuleSourceDisplayString(rule.source)}`}</Text>
  )
}

function getRuleBehaviorLabel(ruleBehavior: PermissionBehavior): string {
  switch (ruleBehavior) {
    case 'allow':
      return 'allowed'
    case 'deny':
      return 'denied'
    case 'ask':
      return 'ask'
  }
}

function RuleDetails({
  rule,
  onDelete,
  onCancel,
}: RuleDetailsProps): React.ReactNode {
  const exitState = useExitOnCtrlCDWithKeybindings()

  useKeybinding('confirm:no', onCancel, {
    context: 'Confirmation',
  })

  const ruleString = permissionRuleValueToString(rule.ruleValue)
  const ruleDescription = (
    <Box flexDirection="column" marginX={2}>
      <Text bold>{ruleString}</Text>
      <PermissionRuleDescription ruleValue={rule.ruleValue} />
      <RuleSourceText rule={rule} />
    </Box>
  )
  const footer = (
    <Box marginLeft={3}>
      {exitState.pending ? (
        <Text dimColor>{`Press ${exitState.keyName} again to exit`}</Text>
      ) : (
        <Text dimColor>Esc to cancel</Text>
      )}
    </Box>
  )

  if (rule.source === 'policySettings') {
    return (
      <>
        <Box
          flexDirection="column"
          gap={1}
          borderStyle="round"
          paddingLeft={1}
          paddingRight={1}
          borderColor="permission"
        >
          <Text bold color="permission">
            Rule details
          </Text>
          {ruleDescription}
          <Text italic>
            This rule is configured by managed settings and cannot be modified.
            {'\n'}
            Contact your system administrator for more information.
          </Text>
        </Box>
        {footer}
      </>
    )
  }

  return (
    <>
      <Box
        flexDirection="column"
        gap={1}
        borderStyle="round"
        paddingLeft={1}
        paddingRight={1}
        borderColor="error"
      >
        <Text bold color="error">
          {`Delete ${getRuleBehaviorLabel(rule.ruleBehavior)} tool?`}
        </Text>
        {ruleDescription}
        <Text>Are you sure you want to delete this permission rule?</Text>
        <Select
          options={[
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ]}
          onChange={value => (value === 'yes' ? onDelete() : onCancel())}
          onCancel={onCancel}
        />
      </Box>
      {footer}
    </>
  )
}

function RulesTabContent({
  options,
  searchQuery,
  isSearchMode,
  isFocused,
  onSelect,
  onCancel,
  lastFocusedRuleKey,
  cursorOffset,
  onHeaderFocusChange,
}: RulesTabContentProps): React.ReactNode {
  const tabWidth = useTabsWidth()
  const { headerFocused, focusHeader, blurHeader } = useTabHeaderFocus()

  useEffect(() => {
    if (isSearchMode && headerFocused) {
      blurHeader()
    }
  }, [blurHeader, headerFocused, isSearchMode])

  useEffect(() => {
    onHeaderFocusChange?.(headerFocused)
  }, [headerFocused, onHeaderFocusChange])

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <SearchBox
          query={searchQuery}
          isFocused={isSearchMode && !headerFocused}
          isTerminalFocused={isFocused}
          width={tabWidth}
          cursorOffset={cursorOffset}
        />
      </Box>
      <Select
        options={options}
        onChange={onSelect}
        onCancel={onCancel}
        visibleOptionCount={Math.min(10, options.length)}
        isDisabled={isSearchMode || headerFocused}
        defaultFocusValue={lastFocusedRuleKey}
        onUpFromFirstItem={focusHeader}
      />
    </Box>
  )
}

function PermissionRulesTab({
  tab,
  getRulesOptions,
  handleToolSelect,
  ...rulesProps
}: PermissionRulesTabProps): React.ReactNode {
  const descriptions: Record<RuleTab, string> = {
    allow: "Claude Code won't ask before using allowed tools.",
    ask: 'Claude Code will always ask for confirmation before using these tools.',
    deny: 'Claude Code will always reject requests to use denied tools.',
  }

  const { options } = getRulesOptions(tab, rulesProps.searchQuery)

  return (
    <Box flexDirection="column" flexShrink={tab === 'allow' ? 0 : undefined}>
      <Text>{descriptions[tab]}</Text>
      <RulesTabContent
        {...rulesProps}
        options={options}
        onSelect={value => handleToolSelect(value, tab)}
      />
    </Box>
  )
}

function buildRulesByKey(rules: PermissionRule[]): RulesByKey {
  const map = new Map<string, PermissionRule>()
  for (const rule of rules) {
    map.set(jsonStringify(rule), rule)
  }
  return map
}

function toRuleOptions(
  rulesByKey: RulesByKey,
  tab: TabType,
  query = '',
): RulesLookupResult {
  const options: Option[] = []

  if (tab !== 'workspace' && tab !== 'recent' && query.length === 0) {
    options.push({
      label: `Add a new rule${figures.ellipsis}`,
      value: 'add-new-rule',
    })
  }

  const sortedRuleKeys = Array.from(rulesByKey.keys()).sort((a, b) => {
    const ruleA = rulesByKey.get(a)
    const ruleB = rulesByKey.get(b)
    if (!ruleA || !ruleB) {
      return 0
    }

    return permissionRuleValueToString(ruleA.ruleValue)
      .toLowerCase()
      .localeCompare(permissionRuleValueToString(ruleB.ruleValue).toLowerCase())
  })

  const lowerQuery = query.toLowerCase()
  for (const ruleKey of sortedRuleKeys) {
    const rule = rulesByKey.get(ruleKey)
    if (!rule) {
      continue
    }

    const ruleString = permissionRuleValueToString(rule.ruleValue)
    if (query && !ruleString.toLowerCase().includes(lowerQuery)) {
      continue
    }

    options.push({
      label: ruleString,
      value: ruleKey,
    })
  }

  return { options, rulesByKey }
}

export function PermissionRuleList({
  onExit,
  initialTab,
  onRetryDenials,
}: Props): React.ReactNode {
  const hasDenials = getAutoModeDenials().length > 0
  const defaultTab = initialTab ?? (hasDenials ? 'recent' : 'allow')

  const [changes, setChanges] = useState<string[]>([])
  const toolPermissionContext = useAppState(state => state.toolPermissionContext)
  const setAppState = useSetAppState()
  const isTerminalFocused = useTerminalFocus()
  const denialStateRef = useRef<DenialState>({
    approved: new Set<number>(),
    retry: new Set<number>(),
    denials: [],
  })
  const [selectedRule, setSelectedRule] = useState<PermissionRule>()
  const [lastFocusedRuleKey, setLastFocusedRuleKey] = useState<string>()
  const [addingRuleToTab, setAddingRuleToTab] = useState<RuleTab | null>(null)
  const [validatedRule, setValidatedRule] =
    useState<ValidatedRuleState | null>(null)
  const [isAddingWorkspaceDirectory, setIsAddingWorkspaceDirectory] =
    useState(false)
  const [removingDirectory, setRemovingDirectory] = useState<string | null>(
    null,
  )
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [headerFocused, setHeaderFocused] = useState(true)

  const allowRulesByKey = useMemo(
    () => buildRulesByKey(getAllowRules(toolPermissionContext)),
    [toolPermissionContext],
  )
  const denyRulesByKey = useMemo(
    () => buildRulesByKey(getDenyRules(toolPermissionContext)),
    [toolPermissionContext],
  )
  const askRulesByKey = useMemo(
    () => buildRulesByKey(getAskRules(toolPermissionContext)),
    [toolPermissionContext],
  )

  const getRulesOptions = useCallback(
    (tab: TabType, query = ''): RulesLookupResult => {
      switch (tab) {
        case 'allow':
          return toRuleOptions(allowRulesByKey, tab, query)
        case 'deny':
          return toRuleOptions(denyRulesByKey, tab, query)
        case 'ask':
          return toRuleOptions(askRulesByKey, tab, query)
        case 'workspace':
        case 'recent':
          return { options: [], rulesByKey: new Map<string, PermissionRule>() }
      }
    },
    [allowRulesByKey, askRulesByKey, denyRulesByKey],
  )

  const exitState = useExitOnCtrlCDWithKeybindings()
  const isSearchModeActive =
    !selectedRule &&
    !addingRuleToTab &&
    !validatedRule &&
    !isAddingWorkspaceDirectory &&
    !removingDirectory

  const { query: searchQuery, setQuery: setSearchQuery, cursorOffset } =
    useSearchInput({
      isActive: isSearchModeActive && isSearchMode,
      onExit: () => setIsSearchMode(false),
    })

  const updateToolPermissionContext = useCallback(
    (nextContext: ToolPermissionContext) => {
      setAppState(prev => ({
        ...prev,
        toolPermissionContext: nextContext,
      }))
    },
    [setAppState],
  )

  const handleHeaderFocusChange = useCallback((focused: boolean) => {
    setHeaderFocused(focused)
  }, [])

  const handleDenialStateChange = useCallback((state: DenialState) => {
    denialStateRef.current = state
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isSearchModeActive || isSearchMode) {
        return
      }
      if (event.ctrl || event.meta) {
        return
      }

      if (event.key === '/') {
        event.preventDefault()
        setIsSearchMode(true)
        setSearchQuery('')
        return
      }

      if (
        event.key.length === 1 &&
        !['j', 'k', 'm', 'i', 'r', ' '].includes(event.key)
      ) {
        event.preventDefault()
        setIsSearchMode(true)
        setSearchQuery(event.key)
      }
    },
    [isSearchMode, isSearchModeActive, setSearchQuery],
  )

  const handleToolSelect = useCallback(
    (selectedValue: string, tab: RuleTab) => {
      const { rulesByKey } = getRulesOptions(tab)

      if (selectedValue === 'add-new-rule') {
        setAddingRuleToTab(tab)
        return
      }

      setSelectedRule(rulesByKey.get(selectedValue))
    },
    [getRulesOptions],
  )

  const handleRuleInputSubmit = useCallback(
    (ruleValue: PermissionRuleValue, ruleBehavior: RuleTab) => {
      setValidatedRule({ ruleValue, ruleBehavior })
      setAddingRuleToTab(null)
    },
    [],
  )

  const handleAddRulesSuccess = useCallback(
    (rules: PermissionRule[], unreachable?: UnreachableRule[]) => {
      setValidatedRule(null)

      for (const rule of rules) {
        setChanges(prev => [
          ...prev,
          `Added ${rule.ruleBehavior} rule ${chalk.bold(permissionRuleValueToString(rule.ruleValue))}`,
        ])
      }

      if (!unreachable?.length) {
        return
      }

      for (const issue of unreachable) {
        const severity = issue.shadowType === 'deny' ? 'blocked' : 'shadowed'
        setChanges(prev => [
          ...prev,
          chalk.yellow(
            `${figures.warning} Warning: ${permissionRuleValueToString(issue.rule.ruleValue)} is ${severity}`,
          ),
          chalk.dim(`  ${issue.reason}`),
          chalk.dim(`  Fix: ${issue.fix}`),
        ])
      }
    },
    [],
  )

  const handleRulesCancel = useCallback(() => {
    const state = denialStateRef.current
    const denialsFor = (indexes: Set<number>) =>
      Array.from(indexes)
        .map(idx => state.denials[idx])
        .filter((denial): denial is { display: string } => denial !== undefined)

    const retryDenials = denialsFor(state.retry)
    if (retryDenials.length > 0) {
      const commands = retryDenials.map(denial => denial.display)
      onRetryDenials?.(commands)
      onExit(undefined, {
        shouldQuery: true,
        metaMessages: [
          `Permission granted for: ${commands.join(', ')}. You may now retry ${commands.length === 1 ? 'this command' : 'these commands'} if you would like.`,
        ],
      })
      return
    }

    const approvedDenials = denialsFor(state.approved)
    if (approvedDenials.length > 0 || changes.length > 0) {
      const approvedMessages =
        approvedDenials.length > 0
          ? [
              `Approved ${approvedDenials
                .map(denial => chalk.bold(denial.display))
                .join(', ')}`,
            ]
          : []
      onExit([...approvedMessages, ...changes].join('\n'))
      return
    }

    onExit('Permissions dialog dismissed', { display: 'system' })
  }, [changes, onExit, onRetryDenials])

  useKeybinding('confirm:no', handleRulesCancel, {
    context: 'Settings',
    isActive: isSearchModeActive && !isSearchMode,
  })

  const handleDeleteRule = useCallback(() => {
    if (!selectedRule) {
      return
    }

    const { options } = getRulesOptions(selectedRule.ruleBehavior as RuleTab)
    const selectedKey = jsonStringify(selectedRule)
    const ruleKeys = options
      .filter(option => option.value !== 'add-new-rule')
      .map(option => option.value)
    const currentIndex = ruleKeys.indexOf(selectedKey)

    let nextFocusKey: string | undefined
    if (currentIndex !== -1) {
      if (currentIndex < ruleKeys.length - 1) {
        nextFocusKey = ruleKeys[currentIndex + 1]
      } else if (currentIndex > 0) {
        nextFocusKey = ruleKeys[currentIndex - 1]
      }
    }

    setLastFocusedRuleKey(nextFocusKey)
    deletePermissionRule({
      rule: selectedRule,
      initialContext: toolPermissionContext,
      setToolPermissionContext: updateToolPermissionContext,
    })
    setChanges(prev => [
      ...prev,
      `Deleted ${selectedRule.ruleBehavior} rule ${chalk.bold(permissionRuleValueToString(selectedRule.ruleValue))}`,
    ])
    setSelectedRule(undefined)
  }, [
    getRulesOptions,
    selectedRule,
    toolPermissionContext,
    updateToolPermissionContext,
  ])

  if (selectedRule) {
    return (
      <RuleDetails
        rule={selectedRule}
        onDelete={handleDeleteRule}
        onCancel={() => setSelectedRule(undefined)}
      />
    )
  }

  if (addingRuleToTab) {
    return (
      <PermissionRuleInput
        onCancel={() => setAddingRuleToTab(null)}
        onSubmit={handleRuleInputSubmit}
        ruleBehavior={addingRuleToTab}
      />
    )
  }

  if (validatedRule) {
    return (
      <AddPermissionRules
        onAddRules={handleAddRulesSuccess}
        onCancel={() => setValidatedRule(null)}
        ruleValues={[validatedRule.ruleValue]}
        ruleBehavior={validatedRule.ruleBehavior}
        initialContext={toolPermissionContext}
        setToolPermissionContext={updateToolPermissionContext}
      />
    )
  }

  if (isAddingWorkspaceDirectory) {
    const handleAddDirectory = (path: string, remember?: boolean) => {
      const destination: PermissionUpdateDestination = remember
        ? 'localSettings'
        : 'session'
      const permissionUpdate = {
        type: 'addDirectories' as const,
        directories: [path],
        destination,
      }
      const updatedContext = applyPermissionUpdate(
        toolPermissionContext,
        permissionUpdate,
      )

      updateToolPermissionContext(updatedContext)
      if (remember) {
        persistPermissionUpdate(permissionUpdate)
      }

      setChanges(prev => [
        ...prev,
        `Added directory ${chalk.bold(path)} to workspace${remember ? ' and saved to local settings' : ' for this session'}`,
      ])
      setIsAddingWorkspaceDirectory(false)
    }

    return (
      <AddWorkspaceDirectory
        onAddDirectory={handleAddDirectory}
        onCancel={() => setIsAddingWorkspaceDirectory(false)}
        permissionContext={toolPermissionContext}
      />
    )
  }

  if (removingDirectory) {
    return (
      <RemoveWorkspaceDirectory
        directoryPath={removingDirectory}
        onRemove={() => {
          setChanges(prev => [
            ...prev,
            `Removed directory ${chalk.bold(removingDirectory)} from workspace`,
          ])
          setRemovingDirectory(null)
        }}
        onCancel={() => setRemovingDirectory(null)}
        permissionContext={toolPermissionContext}
        setPermissionContext={updateToolPermissionContext}
      />
    )
  }

  const sharedRulesProps: Omit<RulesTabContentProps, 'options' | 'onSelect'> = {
    searchQuery,
    isSearchMode,
    isFocused: isTerminalFocused,
    onCancel: handleRulesCancel,
    lastFocusedRuleKey,
    cursorOffset,
    onHeaderFocusChange: handleHeaderFocusChange,
  }

  const isHidden =
    !!selectedRule ||
    !!addingRuleToTab ||
    !!validatedRule ||
    isAddingWorkspaceDirectory ||
    !!removingDirectory

  const footerText = exitState.pending
    ? `Press ${exitState.keyName} again to exit`
    : headerFocused
      ? 'Tab/Left/Right switch tabs | Down enter content | Esc cancel'
      : isSearchMode
        ? 'Type to filter | Enter select | Tab/Left/Right switch tabs | Esc clear'
        : hasDenials && defaultTab === 'recent'
          ? 'Enter approve | r retry | Up/Down navigate | Tab/Left/Right switch tabs | Esc cancel'
          : 'Up/Down navigate | Enter select | Type to search | Tab/Left/Right switch tabs | Esc cancel'

  return (
    <Box flexDirection="column" onKeyDown={handleKeyDown}>
      <Pane color="permission">
        <Tabs
          title="Permissions:"
          color="permission"
          defaultTab={defaultTab}
          hidden={isHidden}
          initialHeaderFocused={!hasDenials}
          navFromContent={!isSearchMode}
        >
          <Tab id="recent" title="Recently denied">
            <RecentDenialsTab
              onHeaderFocusChange={handleHeaderFocusChange}
              onStateChange={handleDenialStateChange}
            />
          </Tab>
          <Tab id="allow" title="Allow">
            <PermissionRulesTab
              tab="allow"
              getRulesOptions={getRulesOptions}
              handleToolSelect={handleToolSelect}
              {...sharedRulesProps}
            />
          </Tab>
          <Tab id="ask" title="Ask">
            <PermissionRulesTab
              tab="ask"
              getRulesOptions={getRulesOptions}
              handleToolSelect={handleToolSelect}
              {...sharedRulesProps}
            />
          </Tab>
          <Tab id="deny" title="Deny">
            <PermissionRulesTab
              tab="deny"
              getRulesOptions={getRulesOptions}
              handleToolSelect={handleToolSelect}
              {...sharedRulesProps}
            />
          </Tab>
          <Tab id="workspace" title="Workspace">
            <Box flexDirection="column">
              <Text>
                Claude Code can read files in the workspace, and make edits when
                auto-accept edits is on.
              </Text>
              <WorkspaceTab
                onExit={onExit}
                toolPermissionContext={toolPermissionContext}
                onRequestAddDirectory={() => setIsAddingWorkspaceDirectory(true)}
                onRequestRemoveDirectory={setRemovingDirectory}
                onHeaderFocusChange={handleHeaderFocusChange}
              />
            </Box>
          </Tab>
        </Tabs>
        <Box marginTop={1} paddingLeft={1}>
          <Text dimColor>{footerText}</Text>
        </Box>
      </Pane>
    </Box>
  )
}
