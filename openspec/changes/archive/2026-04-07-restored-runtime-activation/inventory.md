## Runtime Activation Checkpoint

Execution checkpoint: `dd7cf0f`

## Restore Pass Update

After the first restore-oriented implementation pass, the scanner count moved:

- from `86`
- to `38`

This pass restored three bounded groups:

- shared support-file bucket
- lightweight bundled skill placeholders
- bundled `claude-api` documentation placeholders plus two lightweight source placeholders

Current implication:

- the original `restore` bucket is mostly exhausted for low-risk work
- the remaining unresolved imports now overwhelmingly fit `guard` or `shim`
- two remaining `commands/clear/index.ts` entries are scanner false positives caused by comment text, not runtime imports

Current validation split:

- `bun src/entrypoints/cli.tsx --version`: passes
- `bun src/entrypoints/cli.tsx --help`: passes
- `npm run validate:restoration`: passes
- `bun run dev`: scanner-only behavior; does not represent direct runtime activation
- `bun src/entrypoints/cli.tsx --bare -p "Say OK only."`: still stalls without producing a printed response in the current bounded window

Direct runtime blocker narrowing:

- The last emitted debug line is from `initializeTelemetry()` after telemetry enablement is evaluated.
- `initializeTelemetryAfterTrust()` is not awaited in print mode, so this log position does **not** prove telemetry is the blocking stage.
- The next blocker is therefore narrowed to the headless startup await chain after startup completion, not to the telemetry fire-and-forget path itself.
- The most relevant awaited print-mode stages immediately after startup are:
  - org validation
  - headless initialization
  - awaited MCP connection batch
  - first request path setup

This is narrow enough for the current phase: the active blocker is now "post-startup headless runtime activation" rather than "telemetry initialization".

## Guard And Shim Pass Update

After the first bounded `guard` and `shim` pass, the scanner count moved:

- from `38`
- to `22`

This pass added minimal degraded implementations for:

- `services/skillSearch/*`
- `coordinator/workerAgent.js`
- `assistant/sessionDiscovery.js`
- `utils/udsMessaging.js`
- `utils/udsClient.js`
- `bridge/peerSessions.js`
- `skills/mcpSkills.js`
- `utils/protectedNamespace.js`

Current implication:

- the previous highest-yield internal guard bucket has been consumed successfully
- the remaining unresolved imports are now concentrated in Anthropic-only UI adjuncts, SSH extras, internal tool prompts, and two known scanner false positives under `commands/clear/index.ts`
- `mcpSkills.js` no longer blocks MCP cache invalidation callsites because the shim preserves a `.cache.delete(...)` surface

## Scanner Alignment Update

After the final scanner-alignment pass, `src/dev-entry.ts` no longer reports any blocking unresolved relative imports for the restored launcher path.

This pass did two things:

- added thin no-op stubs for the last feature-gated assistant, proactive, tool, and UI helper modules that were only preventing scanner forwarding
- corrected scanner over-counting by excluding:
  - `import type` and `export type` surfaces
  - comment-text false positives
  - optional native `.node` bindings that are already guarded by runtime fallback wrappers

Observed result:

- `bun run ./src/dev-entry.ts --version` now forwards and prints `2.1.88`
- `bun run ./src/dev-entry.ts --help` now forwards to the real launcher help output

Current implication:

- scanner-mode restoration is no longer the active blocker for the launcher path
- the next blocker, if any, must come from direct runtime behavior rather than unresolved relative-import accounting
- `npm run validate:restoration` remains green after forwarding recovery
- the forwarded `--bare -p "Say OK only."` path still stalls in the previously narrowed post-startup runtime region

## Import-Time Blocker Resolution Update

After forwarded launcher recovery, the remaining headless stall was resolved by fixing two concrete import-time defects in the real runtime path.

Resolved defects:

- `src/utils/envDynamic.ts`
  - previous failure: `ReferenceError: Cannot access 'env' before initialization`
  - cause: eager `...env` expansion during circular module initialization
  - fix: changed `envDynamic` to lazy property resolution via `Proxy`
- `src/utils/filePersistence/types.ts`
  - previous failure: missing `DEFAULT_UPLOAD_CONCURRENCY` export while importing `src/cli/print.ts`
  - cause: the earlier restoration stub only exported `TurnStartTime`
  - fix: expanded the stub to include the constants and event/result types required by `filePersistence.ts`

Observed result after both fixes:

- `bun -e "await import('./src/cli/structuredIO.ts')"`: passes
- `bun -e "await import('./src/cli/print.ts')"`: passes
- `bun run ./src/dev-entry.ts --bare -p "Say OK only."`: no longer stalls in import-time startup

Current implication:

- the minimum runtime gate is now limited by local authentication state rather than restored-source import defects
- further work on this prompt path should focus on authenticated environment validation, not additional import restoration

## Current Runtime Activation Result

Latest forwarded headless result in this workspace:

- `bun run ./src/dev-entry.ts --bare -p "Say OK only."`
  - progresses through `runHeadless()` and request setup
  - reaches the API client request path
  - exits with `Not logged in · Please run /login`

Interpretation:

- scanner-mode blocking: resolved
- print-runtime import blocking: resolved
- current boundary: expected local auth absence

## Phase-2 Boundary Note

This inventory remains the authoritative classification source for the original mirror-gap buckets, but it is no longer the primary regression boundary for current work.

Current phase-2 regression boundary:

- `bun run ./src/dev-entry.ts --version`
- `bun run ./src/dev-entry.ts -p "Say OK only."`
- `node scripts/validate-restoration.mjs`

Current phase-2 interpretation:

- non-bare launcher success is the operative runtime signal
- bare-mode OAuth absence remains expected behavior under `--bare`
- future cleanup should use this inventory for bucket selection, not as a signal that runtime activation is still incomplete

## Phase-2 Active Non-Bare Placeholder Refresh

Refreshed on 2026-04-07 using current importer relationships and normal launcher validation.

Remaining placeholders or guards still exercised by active non-bare runtime or validation paths:

- `src/services/remoteManagedSettings/index.ts` -> `./securityCheck.jsx`
- `src/setup.ts`, `src/cli/print.ts`, `src/utils/messages/systemInit.ts` -> `../utils/udsMessaging.js`
- `src/main.tsx`, `src/dialogLaunchers.tsx` -> `./assistant/sessionDiscovery.js`
- `src/constants/prompts.ts`, `src/utils/attachments.ts`, `src/tools/SkillTool/SkillTool.ts` -> `../services/skillSearch/featureCheck.js`

Observed mostly type-only placeholder consumers:

- `src/types/plugin.ts`, `src/utils/plugins/lspPluginIntegration.ts` -> `../services/lsp/types.js`

Current implication:

- no additional active-path placeholder was found in this refresh that requires immediate hardening beyond the already-completed `filePersistence/types.ts` fix
- the next useful phase-2 work is guard/defer consolidation, not another broad placeholder sweep

## Phase-2 Guard / Defer Consolidation

Guard bucket kept intentionally unsupported in the current mirror:

- internal session and messaging helpers: `udsMessaging.js`, `udsClient.js`, `peerSessions.js`
- assistant and worker coordination helpers: `assistant/sessionDiscovery.js`, `coordinator/workerAgent.js`
- remote skill-search helpers: `services/skillSearch/*`
- SSH / REPL side branches and Anthropic-only UI adjuncts
- internal-only classifier and tool panel helpers

Why these remain guarded:

- they sit behind optional, internal, or branch-specific flows
- no current normal non-bare validation shows they are required for the supported launcher boundary
- speculative donor-style recreation would add risk without improving the current supported runtime

Defer bucket kept intentionally out of the current supported runtime boundary:

- bundled Claude API documentation placeholders
- secondary bundled skill registration placeholders
- non-essential prompt assets such as `utils/ultraplan/prompt.txt`
- auxiliary helper files such as `query/transitions.js`, `utils/taskSummary.js`, and `tools/SnipTool/prompt.js`

Why these remain deferred:

- they are documentation-heavy, auxiliary, or otherwise non-essential to the validated normal launcher path
- no current validation signal justifies promoting them into the active runtime bucket

Phase-2 final interpretation:

- remaining mirror gaps are now explicitly partitioned between intentional `guard` and intentional `defer`
- future work should open narrower follow-up changes only if one of those preserved surfaces becomes part of a newly supported runtime flow

## Current Missing Import Inventory

Source: `src/dev-entry.ts` scanner logic, refreshed in this workspace on 2026-04-07.

Initial captured count: `86`

Current post-guard/shim count before scanner-alignment fixes: `22`

Current scanner-blocking count after scanner-alignment fixes: `0`

Inventory shape:

- importer root counts:
  - `skills`: 29
  - `utils`: 13
  - `services`: 8
  - `screens`: 7
  - `tools`: 7
  - `query/query.ts`: 5
  - `commands/commands.ts`: 4
  - `hooks`: 3
  - `constants`: 3
  - `ink`: 3
  - other singletons: 4
- rough treatment signal counts:
  - asset or native dependency gaps: 31
  - likely dead-code-eliminated or internal feature surfaces: 30
  - ordinary source gaps: 16
  - shared type-surface gaps: 9

## Treatment Rules

- `restore`: use when the missing target is a normal local source file or asset that belongs to supported user-visible behavior, especially if it is startup-adjacent or shared by multiple runtime paths.
- `shim`: use when the missing target is primarily a type-surface, native boundary, or compatibility contract where a minimal replacement is safer than a full recreation.
- `guard`: use when the missing target belongs to an internal, optional, or feature-gated surface that should not block the minimum runtime gate.
- `defer`: use when the missing target is not required for the current runtime gate and can remain absent after being explicitly classified.

## Classification Results

### Restore

These are low-risk local source or asset gaps that fit normal restoration rather than feature removal:

- `src/commands/clear/index.ts` -> `./clear/caches.js`, `./clear/conversation.js`
- `src/ink/events/event-handlers.ts` -> `./paste-event.js`, `./resize-event.js`
- `src/ink/frame.ts` -> `./cursor.js`
- `src/services/lsp/config.ts` -> `./types.js`
- `src/services/lsp/LSPServerInstance.ts` -> `./types.js`
- `src/services/lsp/LSPServerManager.ts` -> `./types.js`
- `src/services/tips/tipRegistry.ts` -> `./types.js`
- `src/services/tips/tipScheduler.ts` -> `./types.js`
- `src/utils/filePersistence/filePersistence.ts` -> `./types.js`
- `src/utils/filePersistence/outputsScanner.ts` -> `./types.js`
- `src/services/remoteManagedSettings/index.ts` -> `./securityCheck.jsx`
- `src/utils/permissions/yoloClassifier.ts` -> `./yolo-classifier-prompts/auto_mode_system_prompt.txt`, `./yolo-classifier-prompts/permissions_anthropic.txt`, `./yolo-classifier-prompts/permissions_external.txt`

Rationale:
- these look like ordinary local-source or local-asset restoration gaps
- several are shared support files referenced by multiple importers
- none of them require recreating an internal Anthropic-only subsystem

### Shim

These are better treated as compatibility surfaces than as full feature restoration:

- `src/types/plugin.ts` -> `../services/lsp/types.js`
- `src/utils/plugins/lspPluginIntegration.ts` -> `../../services/lsp/types.js`
- `src/services/mcp/client.ts` -> `../../skills/mcpSkills.js`
- `src/services/mcp/useManageMCPConnections.ts` -> `../../skills/mcpSkills.js`
- `vendor/image-processor-src/index.ts` -> `../../image-processor.node`

Rationale:
- these are type or adapter boundaries, not primary runtime features
- a minimal shared contract is more valuable here than speculative recreation

### Guard

These belong to internal, optional, or clearly feature-gated surfaces and should not block the minimum runtime gate:

- `src/cli/print.ts` -> `../utils/udsMessaging.js`
- `src/commands.ts` -> `./commands/agents-platform/index.js`
- `src/constants/prompts.ts` -> `../services/compact/cachedMCConfig.js`, `../services/skillSearch/featureCheck.js`, `../tools/DiscoverSkillsTool/prompt.js`
- `src/dialogLaunchers.tsx` -> `./assistant/sessionDiscovery.js`
- `src/hooks/useReplBridge.tsx` -> `../bridge/webhookSanitizer.js`
- `src/hooks/useSSHSession.ts` -> `../ssh/createSSHSession.js`, `../ssh/SSHSessionManager.js`
- `src/query.ts` -> `./jobs/classifier.js`, `./services/skillSearch/prefetch.js`
- `src/query/stopHooks.ts` -> `../jobs/classifier.js`
- `src/screens/REPL.tsx` -> `../components/AntModelSwitchCallout.js`, `../components/FeedbackSurvey/useFrustrationDetection.js`, `../components/UndercoverAutoCallout.js`, `../hooks/notifs/useAntOrgWarningNotification.js`, `../ssh/createSSHSession.js`, `../tools/TungstenTool/TungstenLiveMonitor.js`, `../tools/WebBrowserTool/WebBrowserPanel.js`
- `src/tools/AgentTool/builtInAgents.ts` -> `../../coordinator/workerAgent.js`
- `src/tools/SendMessageTool/SendMessageTool.ts` -> `../../bridge/peerSessions.js`, `../../utils/udsClient.js`
- `src/tools/SkillTool/SkillTool.ts` -> `../../services/skillSearch/featureCheck.js`, `../../services/skillSearch/remoteSkillLoader.js`, `../../services/skillSearch/remoteSkillState.js`, `../../services/skillSearch/telemetry.js`
- `src/utils/attachments.ts` -> `../services/skillSearch/signals.js`
- `src/utils/envUtils.ts` -> `./protectedNamespace.js`
- `src/utils/messages/systemInit.ts` -> `../udsMessaging.js`
- `src/utils/permissions/classifierDecision.ts` -> `../../tools/OverflowTestTool/OverflowTestTool.js`, `../../tools/TerminalCaptureTool/prompt.js`, `../../tools/VerifyPlanExecutionTool/constants.js`

Rationale:
- these names line up with internal agents, UDS/peer messaging, remote skill search, Anthropic-only UI callouts, SSH add-ons, or internal-only tools
- they are poor candidates for speculative restoration during minimum runtime activation

### Defer

These are absent assets or secondary files that are not needed for the minimum direct runtime gate and can remain out of scope once documented:

- `src/commands/ultraplan.tsx` -> `../utils/ultraplan/prompt.txt`
- `src/query.ts` -> `./query/transitions.js`, `./utils/taskSummary.js`
- `src/skills/bundled/claudeApiContent.ts` -> `./claude-api/SKILL.md`, `./claude-api/shared/*.md`, `./claude-api/csharp/claude-api.md`, `./claude-api/curl/examples.md`, `./claude-api/go/claude-api.md`, `./claude-api/java/claude-api.md`, `./claude-api/php/claude-api.md`, `./claude-api/ruby/claude-api.md`, `./claude-api/python/agent-sdk/*.md`, `./claude-api/python/claude-api/*.md`, `./claude-api/typescript/agent-sdk/*.md`, `./claude-api/typescript/claude-api/*.md`
- `src/skills/bundled/index.ts` -> `./dream.js`, `./hunter.js`, `./runSkillGenerator.js`
- `src/utils/collapseReadSearch.ts` -> `../tools/SnipTool/prompt.js`

Rationale:
- these are documentation bundles, secondary prompts, or non-essential auxiliary flows
- they should be evaluated only after the minimum runtime gate is active

## Smallest Useful Buckets

Smallest `restore` bucket with clear leverage:

- shared local support files and assets:
  - `services/lsp/types.js`
  - `services/tips/types.js`
  - `utils/filePersistence/types.js`
  - `remoteManagedSettings/securityCheck.jsx`
  - `utils/permissions/yolo-classifier-prompts/*`
  - `ink/cursor.js`, `ink/events/paste-event.js`, `ink/events/resize-event.js`

Why this bucket first:

- it removes several multi-importer gaps at low risk
- it does not require inventing internal product behavior
- it improves runtime confidence without reopening broad feature work

Smallest `guard` bucket with clear leverage:

- internal or optional startup-adjacent features:
  - `commands/agents-platform/index.js`
  - `assistant/sessionDiscovery.js`
  - `utils/udsMessaging.js`, `utils/udsClient.js`, `bridge/peerSessions.js`
  - `services/skillSearch/*`
  - `coordinator/workerAgent.js`

Why this bucket first:

- it contains multiple clearly internal or optional surfaces
- it would let launcher policy distinguish unsupported internals from true restoration defects

## Forwarding Criteria

`src/dev-entry.ts` should remain scanner-only until all of the following are true:

- the direct source activation gate remains green for `--version`, `--help`, and `validate:restoration`
- the direct `--bare -p` path either succeeds or fails with a single narrow blocker under active remediation
- there are no unresolved imports left in the `restore` bucket for the minimum runtime path
- all remaining unresolved imports are explicitly recorded as `shim`, `guard`, or `defer`
- any still-unresolved `guard` or `defer` items are confirmed to be outside the minimum runtime path

This means raw missing-import count alone is **not** the forwarding rule.

## Remaining Work Shape

Remaining unresolved imports after the first guard/shim pass are concentrated in:

- Anthropic-only prompt helpers and UI adjuncts
- SSH / REPL adjunct features
- internal tool prompts and internal-only tools
- scanner false positives from comment text

This means the next efficient phase is no longer broad restoration. It is:

- direct runtime activation/debugging on the forwarded launcher path
- keeping scanner logic aligned with active-path semantics rather than raw static import enumeration

## Follow-up Work Buckets

1. Shared support-file restoration
   - restore low-risk local support files and prompt assets used across multiple importers
2. Internal-feature guard layer
   - guard or degrade internal agents, UDS, remote skill search, SSH extras, and Anthropic-only UI callouts
3. Compatibility shims
   - add minimal shared contracts for LSP/MCP type surfaces and native image-processing boundaries
4. Deferred documentation and secondary prompt assets
   - keep documentation-heavy skill bundles and non-essential prompts out of the minimum runtime gate