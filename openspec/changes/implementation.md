# Implementation Notes

## Scope

This file records implementation progress, debug findings, fix decisions, and validation notes for the `provider-abstraction` change.

This file is also the single execution record for the current phase.
Do not create or maintain separate `implementation.md` files under individual change folders unless the execution-record approach is explicitly changed later.

It is not the source of truth for final requirements or architecture:
- Use `specs/model-provider-abstraction/spec.md` for requirements.
- Use `design.md` for final design decisions.
- Use `tasks.md` for implementation status.
- For `runtime-restoration-baseline`, use the runnable-source baseline and restoration-validation specs as the completion contract rather than repository-wide `tsc` cleanliness.

## Recommended Record Format

If this file is used as the execution record for the current phase, keep entries in this order:
- `Review Summary`: current high-level implementation state
- `Debug Record`: symptom, root cause, decision, fix, verification
- `Validation Notes`: what was and was not executed in the current environment
- `Remaining Follow-up`: items intentionally left open

Recommended writing rules:
- keep one dated section per review/remediation pass
- record observed behavior first, then the code decision
- separate `code-path verification` from `executed tests`
- for source-restoration work, separate:
  - runnable baseline status
  - active-path blockers
  - deferred repository-wide type debt
- when validation is blocked by tooling, record the blocker explicitly
- keep execution notes in this file only; avoid parallel per-change implementation logs

Current file status:
- the content is already usable
- the main change needed is to keep newer entries clearly grouped by review pass so task status, bug findings, and remediation do not blur together

## 2026-04-07 Debug Record: Provider Live Smoke Validation

### Review Summary

After establishing the deterministic provider validation gate, the next bounded follow-up was to expose a separate live smoke layer for environments that do have real provider credentials.

This pass kept that layer opt-in and environment-dependent by design:
- default repository validation remains deterministic and secrets-free
- live provider prompt execution is available only through a separate command
- the default behavior of that command is to skip successfully unless explicitly enabled

Current live smoke entrypoint after this pass:
- `bun run ./scripts/validate-provider-live-smoke.mjs`
- `npm run validate:providers:live`

### Debug Record: Default Gate Versus Live Smoke Boundary

#### Symptom

The repository now had a deterministic provider gate, but no explicit place to put real provider-backed prompt execution without weakening the default validation contract.

#### Root Cause

Live prompt execution depends on credentials, network reachability, and remote provider state, while the required regression gate must stay local and reproducible.

#### Decision

Add a separate live smoke command instead of extending `validate:providers` in place.

That command must:
- require explicit opt-in
- report per-provider `ok`, `failed`, or `skipped`
- skip safely when no providers are selected or configured
- reuse the restored source runtime through `bun run ./src/dev-entry.ts --provider <name> -p`

#### Fix

This pass added:
- `src/services/providers/liveSmoke.ts`
  - parses requested provider lists
  - infers candidate providers from configured credentials/endpoints
  - computes provider-specific skip reasons
- `src/services/providers/liveSmoke.test.ts`
  - verifies enablement, provider parsing, inference, and skip-reason logic
- `scripts/validate-provider-live-smoke.mjs`
  - implements the opt-in live smoke contract
  - skips successfully when live smoke is not enabled
  - runs selected provider prompt checks only when explicitly enabled
- `package.json`
  - adds `validate:providers:live`

### Validation Notes

Executed new live-smoke-local validation:
- `bun test src/services/providers/liveSmoke.test.ts`
- `bun run ./scripts/validate-provider-live-smoke.mjs`
- `npm run validate:providers:live`

Observed results:
- helper tests: green
- direct live smoke script without opt-in: skipped successfully
- package live smoke command without opt-in: skipped successfully

Executed regression check for the existing deterministic provider gate:
- `bun run ./scripts/validate-provider-runtime.mjs`

Observed result:
- deterministic provider validation remains green after the live smoke addition

Intentionally unvalidated in this pass:
- actual live provider prompt success for Claude, OpenAI, or Azure OpenAI in this local environment
- CI automation for the live smoke script

### Remaining Follow-up

- If a secured environment later exists for provider-backed smoke CI, wire this script in there rather than promoting it into the default repository gate.
- If operators need richer prompt-success matching later, extend the smoke predicate separately from the current strict `OK` contract.

## 2026-04-07 Debug Record: Provider Runtime Validation

### Review Summary

The new `provider-runtime-validation` change established a deterministic provider regression gate on top of the already-restored source runtime.

This pass deliberately did not broaden provider features. Instead it reused the existing provider startup-validation and diagnostics helpers to create a repeatable validation matrix for:
- `claude`
- `openai`
- `azure-openai`

Current validation entrypoints after this pass:
- `bun run ./scripts/validate-provider-runtime.mjs`
- `npm run validate:restoration`
- `bun run ./src/dev-entry.ts -p "Say OK only."`

### Debug Record: Validation Helper Inventory And Gap

#### Symptom

Provider abstraction, provider diagnostics, and provider-model validation already existed in source, but there was no bounded runtime-facing validation command that combined them into a maintained regression gate.

#### Root Cause

Provider behavior was spread across reusable helpers and tests:
- `src/services/providers/config.ts`
- `src/services/providers/validate.ts`
- `src/services/providers/diagnostics.ts`
- `src/bootstrap/state.ts`
- provider adapter tests under `src/services/providers/*.test.ts`

The repository still relied on maintainers remembering ad hoc command sequences for runtime confirmation.

#### Decision

Add one deterministic provider runtime validation script that:
- reuses source helpers directly for provider config, diagnostics, and compatibility checks
- keeps live network calls out of the default regression gate
- still exercises one real source-runtime command boundary for the known Claude `--bare` auth case

#### Fix

This pass added:
- `scripts/validate-provider-runtime.mjs`
  - validates source version baseline
  - checks expected Claude `--bare` auth boundary
  - checks Claude diagnostics snapshot
  - checks OpenAI startup validation and missing-key failure
  - checks Azure OpenAI startup validation and missing-endpoint/deployment failure
  - checks diagnostics output for resolved model and credential-source context
- `package.json`
  - adds `validate:providers`
- `src/services/providers/provider-selection.test.ts`
  - extends automated coverage for missing OpenAI credentials, missing Azure config, and provider diagnostics reporting

### Debug Record: Provider Boundary Clarification

#### Symptom

The earlier restoration work showed that a Claude `--bare` auth failure could be misread as a runtime regression.

#### Root Cause

`--bare` intentionally disables OAuth and keychain reads, so it validates a different auth boundary from the normal non-bare source runtime.

#### Decision

Encode this outcome directly into the provider validation script as an expected pass condition rather than leaving it as only a historical note.

#### Fix

`scripts/validate-provider-runtime.mjs` now treats a nonzero exit with `Not logged in` on:
- `bun run ./src/dev-entry.ts --bare --provider claude -p "Say OK only."`

as a successful validation of the documented boundary.

### Validation Notes

Executed provider validation:
- `bun test src/services/providers/provider-selection.test.ts`
- `bun run ./scripts/validate-provider-runtime.mjs`

Observed provider validation summary:
- source version baseline: ok
- Claude bare auth boundary: ok
- Claude diagnostics snapshot: ok
- OpenAI startup validation and diagnostics: ok
- OpenAI missing API key failure: ok
- Azure startup validation and diagnostics: ok
- Azure missing endpoint failure: ok

Executed existing restored-runtime checks:
- `npm run validate:restoration`
- `bun run ./src/dev-entry.ts -p "Say OK only."`

Observed restored-runtime results:
- restoration validation: green
- normal non-bare print path: returned `OK`

Intentionally unvalidated in this pass:
- live OpenAI prompt execution against a real endpoint
- live Azure OpenAI prompt execution against a real deployment
- Anthropic-only bridge, remote-session, and OAuth feature parity for non-Claude providers

### Remaining Follow-up

- If teams later want live provider smoke coverage, add it as an explicit opt-in follow-up rather than folding secrets-dependent checks into the default regression gate.
- Consider folding `validate:providers` into a broader restored-runtime validation suite only after both commands stay stable across several follow-up changes.

## 2026-04-03 Debug Record: Runtime Restoration Baseline Round 1

### Review Summary

The new `runtime-restoration-baseline` change started by defining a narrow runnable-source baseline instead of treating full-repository `tsc` success as the immediate gate.

Current runnable baseline:
- `bun src/entrypoints/cli.tsx --version`
- `bun src/entrypoints/cli.tsx --help`
- `node cli.js --version`

Current baseline status after this pass:
- source `--version`: passing
- source `--help`: passing
- prebuilt `cli.js --version`: passing

Repository-wide `tsc` remains a monitoring signal rather than the baseline gate.

### Debug Record: Baseline Definition And Blocker Inventory

#### Symptom

The prebuilt artifact already ran successfully, but the reconstructed source entrypoint failed immediately and gave the team no stable definition of what "restored enough to continue" should mean.

#### Root Cause

Restoration work had been measured mainly through repository-wide `tsc`, which mixed:
- source-entry runtime blockers
- missing published-artifact modules and assets
- broad reconstructed-source typing drift

#### Decision

Define the restoration baseline around startup-oriented source flows first:
- source `--version`
- source `--help`
- prebuilt version parity check

Track anything outside those flows as either active-path follow-up or deferred debt.

#### Fix

This pass established the baseline and the first active-path blocker inventory:
- build-time/global blocker:
  - `MACRO` unavailable during source execution
- runtime-safe optional dependency blocker:
  - `@ant/claude-for-chrome-mcp` was imported as a hard startup dependency
- runtime-critical static asset blocker:
  - bundled `verify` markdown assets were absent from the restored tree
- deferred non-baseline debt:
  - repository-wide `tsc` still reports large volumes of typing and declaration errors

### Debug Record: Source Runtime Compatibility Layer

#### Symptom

`bun src/entrypoints/cli.tsx --version` failed before any meaningful startup validation because `MACRO` was not defined at source runtime.

#### Root Cause

The published bundle relied on build-time injection, but the reconstructed source tree was being executed directly without restoring those injected globals.

#### Decision

Add a minimal source-runtime compatibility layer instead of patching `MACRO` usage callsite-by-callsite.

#### Fix

This pass added:
- `src/entrypoints/sourceRuntimeCompat.ts`
  - initializes a minimal `globalThis.MACRO` from `package.json` metadata when running from source
- early imports of that compatibility layer in:
  - `src/entrypoints/cli.tsx`
  - `src/entrypoints/mcp.ts`
- expanded `MACRO` declarations in `src/global.d.ts` for restoration-era fields consumed by existing source

#### Verification

Executed:
- `bun src/entrypoints/cli.tsx --version`

Observed result:
- returned `2.1.88 (Claude Code)`

### Debug Record: Optional Dependency Guard For Claude In Chrome

#### Symptom

After `MACRO` was restored, source `--help` still failed because startup imported `@ant/claude-for-chrome-mcp`, which is not available in the current restored environment.

#### Root Cause

Claude-in-Chrome files on the startup path treated that external package as a required top-level dependency instead of an optional integration.

#### Decision

Convert the startup-path use of the package into explicit degraded behavior:
- startup must not crash if the package is absent
- actual feature use may fail with a clear restoration-phase message

#### Fix

This pass:
- changed `src/utils/claudeInChrome/setup.ts` to lazily resolve browser tools and throw an explicit feature-level error only when the integration is actually activated
- changed `src/skills/bundled/claudeInChrome.ts` to lazily resolve browser tool metadata instead of hard-importing the package at module load

#### Verification

Executed:
- `bun src/entrypoints/cli.tsx --help`

Intermediate observed result:
- the startup blocker moved off `@ant/claude-for-chrome-mcp` and advanced to missing bundled verify assets, confirming the guard worked

### Debug Record: Donor-Based Static Asset Recovery

#### Symptom

After the optional dependency guard landed, source `--help` still failed because `src/skills/bundled/verifyContent.ts` imported bundled markdown files that were missing from the restored tree.

#### Root Cause

The current repository lacked startup-referenced bundled `verify` markdown assets that existed in the donor runnable fork.

#### Decision

Use the donor runnable fork as a selective restoration reference for startup-critical missing assets.

#### Fix

This pass restored:
- `src/skills/bundled/verify/SKILL.md`
- `src/skills/bundled/verify/examples/cli.md`
- `src/skills/bundled/verify/examples/server.md`

These were restored as placeholder baseline assets sufficient for startup/resource loading.

#### Verification

Executed:
- `bun src/entrypoints/cli.tsx --help`

Observed result:
- the command completed successfully and printed CLI help

### Validation Notes

Executed runtime validation:
- `bun src/entrypoints/cli.tsx --version`
- `bun src/entrypoints/cli.tsx --help`
- `node cli.js --version`
- `node scripts/validate-restoration.mjs`
- `npm run validate:restoration`

Executed repository-wide monitoring validation:
- `./node_modules/.bin/tsc --noEmit -p tsconfig.json --pretty false`

Current monitoring summary from repository-wide `tsc`:
- `TS7006`: 828
- `TS2307`: 288
- `TS2339`: 270
- `TS18046`: 156
- `TS2305`: 115

Interpretation:
- the runnable-source baseline now passes
- repository-wide `tsc` still represents deferred debt, not current baseline failure

### Remaining Follow-up

- Continue task `5.x` donor comparison with grouped import candidates rather than one-off file chases.
- Expand the runnable baseline beyond `--version` and `--help` once the next source flow is chosen.
- Build a fuller categorized inventory of remaining startup-adjacent missing modules and assets.
- Keep repository-wide `tsc` as a monitoring surface until a narrower active-path type validation boundary is justified.

## 2026-04-01 Review Summary

The main provider boundary was implemented at the `query()` model-call seam, and the primary inference path now routes through provider adapters.

During implementation review, several issues were identified in the first pass of OpenAI and Azure OpenAI support:
- Azure OpenAI adapter comments claimed support for Entra ID / `DefaultAzureCredential`, but the no-key path did not acquire a bearer token.
- Provider validation and diagnostics helpers existed, but were not wired into the startup path or status output.
- Model resolution and `/model` validation still assumed Anthropic-centric behavior for non-Claude providers.
- OpenAI-compatible streaming still buffered provider events into a final message instead of fully normalizing incremental events.

## 2026-04-01 Debug Record: Azure OpenAI Auth

### Symptom

`azure-openai` could fail immediately when `AZURE_OPENAI_API_KEY` was not configured, even though comments and config guidance implied an Entra ID fallback path was supported.

### Root Cause

The adapter omitted the `api-key` header when no API key was present, but it did not replace that path with a real bearer token obtained through Azure identity APIs.

### Decision

Keep Azure authentication logic inside the provider adapter so the upper query path stays provider-neutral.

### Fix

The Azure adapter now:
- lazily initializes an Azure bearer token provider using `DefaultAzureCredential`
- requests the `https://cognitiveservices.azure.com/.default` scope
- sends `Authorization: Bearer <token>` when `AZURE_OPENAI_API_KEY` is absent

### Verification

Code-path verification confirmed:
- API key auth remains supported
- Entra ID auth now produces an authenticated request path instead of a bare request

## 2026-04-01 Debug Record: Startup Validation And Diagnostics

### Symptom

Provider validation and diagnostics code had been added, but invalid OpenAI or Azure OpenAI configuration was still only likely to fail at request time.

Status output also remained tied to legacy provider reporting and did not clearly surface generic provider context.

### Root Cause

Validation and diagnostics helpers existed as isolated utilities but were not connected to the actual runtime startup flow or status rendering path.

### Decision

Fail early on invalid provider configuration after model/settings resolution, but before the first request. Keep status output driven by generic provider diagnostics rather than legacy provider enums.

### Fix

The implementation now:
- calls provider config validation during startup
- exits early with an explicit error when provider configuration is invalid
- uses provider diagnostics in status rendering so `openai` and `azure-openai` can report provider name, endpoint context, and limitations

### Verification

Code-path verification confirmed:
- startup now reaches provider validation in the normal CLI flow
- status rendering uses generic provider diagnostics instead of only legacy `apiProvider` classification

## 2026-04-01 Debug Record: Provider-Aware Model Resolution

### Symptom

Model handling still leaked Claude-specific assumptions into non-Claude paths:
- default model selection still leaned on Anthropic conventions
- `/model` validation still depended on Anthropic `sideQuery()` logic
- alias assumptions were not safe for OpenAI or Azure OpenAI

### Root Cause

Model resolution had not yet been split into provider-aware behavior, so new providers inherited Anthropic-centric defaults and validation code paths.

### Decision

Keep Anthropic alias and remote validation behavior only for `claude`. For `openai` and `azure-openai`, treat configured model values as provider-native identifiers and avoid routing validation through Anthropic infrastructure.

### Fix

The implementation now:
- resolves provider-specific model env vars
- keeps Claude alias handling scoped to the Claude provider
- returns provider-native model identifiers for OpenAI and Azure OpenAI
- short-circuits non-Claude `/model` validation to provider config validation rather than Anthropic `sideQuery()`

### Verification

Code-path verification confirmed:
- non-Claude providers no longer depend on Anthropic model alias parsing
- non-Claude `/model` validation no longer routes through Anthropic-only runtime behavior

## Validation Notes

The following checks were performed after the remediation pass:
- repository search confirmed the startup path calls provider config validation
- repository search confirmed status output now consumes generic provider diagnostics
- repository search confirmed OpenAI and Azure headers are now async so auth headers can be resolved dynamically
- repository search confirmed non-Claude model handling no longer depends on Anthropic-only validation paths

An ad hoc TypeScript compile attempt was not a reliable signal for this change because the repository currently has unrelated baseline type issues and missing global type configuration in the checked environment.

## Remaining Follow-up

The main known incomplete area for this change is OpenAI-compatible incremental streaming normalization.

Current status:
- the provider path works at the adapter boundary
- OpenAI-compatible providers still do not fully emit normalized incremental stream events to higher-level consumers

This should remain tracked as follow-up work until streaming behavior, tool-call timing, and partial output semantics are verified against the shared internal stream model.

## 2026-04-01 Debug Record: Azure OpenAI Change Audit And Remediation

### Symptom

During review of the `azure-openai-provider` change, task status and implementation state had drifted:
- the change tasks had been marked complete even though most implementation came from the earlier `provider-abstraction` work
- Azure/OpenAI streaming still behaved as buffered final-output delivery rather than normalized incremental stream delivery
- tool calling was always advertised as supported and was always sent to the backend
- unsupported tool-calling deployments had no adapter-level fallback path

### Root Cause

There were two distinct issues:
- change bookkeeping drift: `azure-openai-provider` task completion no longer reflected what that change had independently implemented and validated
- adapter behavior drift: the OpenAI-compatible adapter reused a streaming HTTP transport but still accumulated chunks into a final assistant message, while capability reporting remained optimistic

### Decision

Keep the existing provider boundary introduced by `provider-abstraction`, but make the Azure/OpenAI adapter behavior line up with the Azure-specific spec:
- emit normalized `stream_event` messages during streaming
- preserve the final `AssistantMessage` for the existing upper-layer flow
- support explicit tool-call capability gating through provider config
- retry once without tools when the backend clearly rejects tool calling

Also keep `azure-openai-provider` task tracking conservative:
- mark code tasks complete only after the remediation landed
- leave validation tasks incomplete until tests are actually run in an environment with the required tooling

### Fix

The remediation pass implemented the following:
- added provider config fields for disabling tools on OpenAI-compatible providers
- added diagnostics output that explicitly reports when tool calling is disabled
- changed `OpenAIAdapter` / `AzureOpenAIAdapter` capability reporting so `toolCalls` is no longer hard-coded to `true`
- changed OpenAI-compatible streaming to emit normalized `stream_event` messages for:
  - `message_start`
  - `content_block_start`
  - `content_block_delta`
  - `content_block_stop`
  - `message_delta`
  - `message_stop`
- preserved final assistant-message emission after streaming completes so existing transcript/tool orchestration paths still receive a normalized final message
- added a backend-rejection fallback path that retries once without tools when the response indicates tool calling is unsupported
- added provider-error categorization helpers for OpenAI-compatible HTTP/network failures before converting them into user-facing system error messages
- updated Azure provider tests to assert incremental stream events, tool fallback behavior, and disabled-tool diagnostics instead of only asserting a single final assistant message

### Verification

Repository-level verification confirmed:
- Azure/OpenAI provider config now supports explicit tool disabling
- diagnostics now surface tool-disabled limitations for Azure/OpenAI
- OpenAI-compatible adapter code now yields normalized stream events before the final assistant message
- Azure tests now check stream-event emission and tool fallback expectations

Runtime validation remains partially pending:
- the local environment used for this remediation did not have `bun` available
- because of that, the updated Azure tests were not executed end-to-end in this session

### Task Tracking Note

After remediation, `azure-openai-provider/tasks.md` was updated to better reflect implementation reality:
- implementation tasks for configuration, adapter wiring, streaming, and tool fallback were marked complete
- validation tasks that require executed tests remain incomplete until they are run in a suitable environment

## 2026-04-01 Debug Record: Provider Review Round 2

### Symptom

During implementation audit of the current `claude/openai` configurable API work, several remaining gaps were found even after the earlier remediation pass:
- the main `query()` path used provider adapters, but some secondary inference paths still called `queryModelWithStreaming()` directly
- OpenAI-compatible adapters had a network-error branch that called a missing helper
- OpenAI-compatible request building still ignored existing `toolChoice` and `extraToolSchemas` behavior used by current Anthropic-oriented call sites

### Root Cause

The provider boundary had been inserted at the primary `query()` seam, but not all inference entry points were migrated to that boundary.

At the same time, the OpenAI adapter implementation focused on the basic streaming path and final message normalization, but left compatibility gaps with existing request options that higher-level code already relied on.

### Decision

Keep the current provider boundary and fix the remaining gaps with minimal surface-area changes:
- route remaining local inference entry points through `providerCallModel`
- keep network failures normalized as provider errors instead of letting adapter runtime errors escape
- preserve existing request semantics where possible by translating `toolChoice` and compatible `extraToolSchemas` into OpenAI-compatible request fields
- explicitly guard Anthropic-only web-search behavior instead of allowing silent degradation on non-Claude providers

### Fix

The current remediation pass implemented the following:
- changed compact summarization to call `providerCallModel` instead of calling `queryModelWithStreaming` directly
- changed the built-in web-search tool to call `providerCallModel` instead of calling `queryModelWithStreaming` directly
- added an Anthropic-only guard to the built-in web-search tool because it depends on Anthropic-specific server-tool behavior
- fixed the OpenAI-compatible adapter network-error path so fetch failures are converted through provider-error normalization instead of calling a missing helper
- added OpenAI-compatible translation for `toolChoice`
- added best-effort OpenAI-compatible translation for `extraToolSchemas` when they expose function-style `name` plus `input_schema`
- merged tool schemas from normal tools, MCP tools, and compatible extra tool schemas before request dispatch

### Verification

Repository-level verification confirmed:
- compact inference now routes through the provider registry
- built-in web-search inference now routes through the provider registry
- web-search now fails fast behind an Anthropic-provider requirement instead of silently drifting into unsupported non-Claude behavior
- the missing OpenAI network-error helper call is removed
- OpenAI-compatible request construction now includes translated tool-choice and compatible extra-tool schema handling

Executed test status in this environment:
- `bun` was not available, so the existing Bun-based adapter tests were not executed here
- `tsc` was not available, so a local no-emit TypeScript compile could not be used as a backstop in this session

### Current Assessment

After this pass, the earlier high-risk issues identified in review are reduced:
- provider routing is no longer limited to only the primary `query()` path for the audited local entry points
- OpenAI/Azure network failures no longer depend on a missing helper
- existing request-option behavior is better preserved for OpenAI-compatible adapters

This does not yet change the validation status of tasks that require executed automated tests; those should remain conservative until tooling-backed validation is run.

## 2026-04-01 Debug Record: Requirement And Change-Log Re-Review

### Symptom

After re-checking the current requirements, task files, and implementation notes together, several follow-up gaps still remain:
- provider selection requirements describe precedence across CLI flags, settings, and environment variables, but the current provider config implementation still resolves only from environment variables plus legacy env compatibility
- Anthropic-only capability guards were added, but actual guard usage is still very limited in the codebase
- OpenAI-compatible adapters still do not implement several request options that exist on the shared `Options` contract
- some task files still read as more complete than the currently verified implementation state

### Root Cause

The provider boundary and initial adapters were implemented first, but several surrounding integration surfaces were only partially migrated:
- configuration precedence was documented more broadly than the current implementation
- capability guards were introduced as infrastructure, but not widely applied at feature entry points
- the shared model-call signature still contains Anthropic-era options that OpenAI-compatible adapters only partially honor
- task completion state drifted ahead of tooling-backed validation

### Decision

Keep these items as explicit remaining debug targets instead of marking the change set complete:
- close the gap between documented provider-selection precedence and actual runtime resolution
- audit Anthropic-only feature entry points and wire capability guards where needed
- review which shared request options must be supported, ignored explicitly, or capability-gated for OpenAI-compatible adapters
- keep validation tasks conservative until executable tests are run

### Findings To Debug Next

1. Provider selection precedence is still narrower than the requirement text.

Current requirement text says provider selection should resolve across CLI flags, settings, and environment variables.

Current implementation in provider config resolves from:
- `CLAUDE_CODE_PROVIDER`
- legacy env compatibility flags
- default `claude`

There is no corresponding provider selection read from settings or explicit CLI provider flags in the current provider config path.

2. Anthropic-only guard rollout appears incomplete.

The guard helpers exist, but current repository usage is still minimal.

In the latest audit, direct guard usage was only confirmed in the built-in web-search path. Other Anthropic-only areas still need a targeted audit to confirm they are gated at their actual entry points rather than only described as gated in provider helper modules.

3. OpenAI-compatible adapters still only partially honor the shared request contract.

The OpenAI-compatible adapter now handles:
- streaming
- tool fallback
- `toolChoice`
- compatible `extraToolSchemas`

But the shared `Options` contract still contains additional fields that are Anthropic-originated and not clearly implemented or explicitly ignored in the OpenAI-compatible path, including:
- `fetchOverride`
- `onStreamingFallback`
- `enablePromptCaching`
- `hasPendingMcpServers`
- `outputFormat`
- `advisorModel`
- API-side `taskBudget` / output-config behavior

Some of these may be intentionally unsupported, but they are not yet documented and capability-gated consistently at the adapter boundary.

4. Task state still needs conservative interpretation.

`provider-abstraction/tasks.md` still marks:
- `2.3` Anthropic-compatible validation complete
- `4.3` OpenAI-compatible validation complete

However, the current execution record still shows local validation blockers:
- `bun` unavailable
- `tsc` unavailable

And the repository audit still does not demonstrate broad executed validation across the existing Anthropic-compatible providers in this session.

### Verification

Repository review confirmed:
- provider config logic still resolves only from env-based inputs
- guard helper definitions exist, but call-site usage remains sparse
- direct `queryModelWithStreaming()` call sites were reduced to the Claude implementation entry itself
- OpenAI-compatible adapter support remains stronger than before, but still does not cover every field on the shared request options contract

### Current Assessment

The highest-value next debug areas are now:
- provider selection precedence versus requirement text
- Anthropic-only feature guard rollout
- explicit handling policy for remaining shared request options on OpenAI-compatible adapters
- tooling-backed validation before treating remaining checked tasks as fully closed

## 2026-04-01 Debug Record: Provider Selection Precedence And Entry Guards

### Symptom

The previous review identified two remaining integration gaps:
- provider selection requirements described precedence across CLI flags, settings, and environment variables, but runtime resolution still only used environment variables
- Anthropic-only capability guards existed, but the most user-visible entry points could still be reached without provider-aware gating

### Root Cause

Provider abstraction work introduced the provider config layer, but selection precedence remained narrower than the requirement text.

At the same time, capability guard helpers were added as reusable infrastructure, but were not yet applied consistently at the command-entry layer for login and remote-control flows.

### Decision

Close the highest-value gap with a minimal precedence implementation:
- add an explicit CLI provider override
- add a persisted settings-based provider selection input
- resolve providers with `CLI > settings > env > legacy compatibility > default`

Also apply provider guards at the most visible Anthropic-only entry points:
- `/login`
- `/remote-control`
- `claude remote-control`

### Fix

The current pass implemented the following:
- added a `provider` setting to the settings schema
- added CLI flag `--provider <provider>` with accepted values:
  - `claude`
  - `openai`
  - `azure-openai`
- added provider resolution support for:
  - direct CLI parsing of `--provider`
  - settings key `provider`
  - existing `CLAUDE_CODE_PROVIDER` env var
- updated provider config precedence to:
  - CLI override
  - settings
  - env
  - legacy Anthropic-compatible compatibility flags
  - default `claude`
- disabled the `/login` command when the active provider does not support OAuth session login
- disabled the local `/remote-control` command when the active provider does not support remote sessions
- added a provider guard to the `claude remote-control` fast path so non-Claude providers fail early with a provider-specific message
- added a provider-aware ignore path for `--rc` / `--remote-control` session startup when the active provider is not Claude

### Verification

Repository-level verification confirmed:
- provider config now reads CLI override, settings, and env in the intended order
- settings schema now accepts a top-level provider field
- CLI parsing now exposes an explicit `--provider` flag
- `/login` command availability now depends on provider OAuth capability
- `/remote-control` command availability now depends on provider remote-session capability
- `claude remote-control` fast path now rejects non-Claude providers before attempting bridge auth or startup

### Current Assessment

This reduces two previously open debug areas:
- provider selection precedence now better matches the requirement text
- Anthropic-only guard rollout now covers the highest-visibility entry points

Remaining follow-up still exists:
- broader Anthropic-only feature entry-point audit is not complete
- OpenAI-compatible adapters still need an explicit policy for the remaining shared request options
- automated validation remains pending in an environment with the required tooling

## 2026-04-01 Debug Record: Non-Streaming Helper Routing And Assistant Guard

### Symptom

After the earlier provider-precedence pass, several important helper paths could still bypass the provider abstraction in practice:
- `queryModelWithoutStreaming()` still called the Anthropic-local `queryModel()` path directly
- `queryHaiku()` and helper flows built on top of it still inherited Claude-only small-model assumptions
- `claude assistant [sessionId]` still entered a bridge-backed remote-session flow without a provider capability gate

### Root Cause

The main `query()` seam had already been migrated to `providerCallModel`, but the non-streaming helper layer was still implemented as a Claude-local convenience wrapper.

That meant many background or sidecar features could still drift into Anthropic-specific behavior even after the main provider path had been generalized.

### Decision

Keep `queryModelWithoutStreaming()` as the central non-streaming helper, but make it provider-aware:
- retain the existing Claude-local implementation for `claude`
- route non-Claude providers through `providerCallModel`

Also tighten the remote-session guard surface by blocking assistant-session attach when the active provider does not support remote sessions.

### Fix

The current pass implemented the following:
- updated provider selection precedence code so runtime behavior now matches the execution record: `CLI > settings > env > legacy > default`
- removed the stale `CLAUDE_CODE_PROVIDER_CLI` execution-record assumption and kept CLI override handling as direct flag parsing
- changed `queryModelWithoutStreaming()` to route through `providerCallModel` for non-Claude providers while preserving the Claude-local path
- updated `getSmallFastModel()` so helper flows on `openai` and `azure-openai` use the provider-configured model/deployment instead of Claude Haiku defaults
- added a provider guard to `claude assistant [sessionId]` so assistant-session attach fails early outside the Claude provider
- refreshed stale provider-registry documentation so future debugging uses the real precedence order

### Verification

Repository-level verification confirmed:
- provider precedence code now resolves `CLI > settings > env`
- non-streaming helper code now reaches `providerCallModel` on non-Claude providers
- `queryHaiku()`-backed helper flows now inherit provider-aware small-model resolution through `getSmallFastModel()`
- assistant-session attach now checks remote-session capability before entering the bridge-backed viewer flow

### Remaining Follow-up

At the end of that pass, the main remaining concern was `sideQuery()`:
- it still talked directly to the Anthropic client
- it still risked leaving classifier, validation, and utility paths outside the provider abstraction

## 2026-04-01 Debug Record: sideQuery Migration

### Symptom

Even after the main query seam and non-streaming helper seam were migrated, `src/utils/sideQuery.ts` still remained as a parallel Anthropic-specific request path.

That left several utility and classifier flows outside the provider abstraction, including:
- permission explanation
- auto-mode critique/classifier requests
- session search
- memory relevance selection
- Claude-in-Chrome MCP helper queries

### Root Cause

`sideQuery()` was originally designed as a lightweight wrapper around direct Anthropic SDK calls so it could handle OAuth attribution, model betas, and structured-output options without going through the main query stack.

That convenience path became an architectural leak once provider abstraction was introduced, because the helper bypassed provider selection entirely.

### Decision

Keep the `sideQuery()` API stable for callers, but split its implementation:
- retain the direct Anthropic client path for `claude`
- route non-Claude providers through `queryModelWithoutStreaming()`
- translate the resulting assistant message back into a `BetaMessage`-like shape so existing call sites do not need a broad rewrite

Also patch the most obvious Claude-only side-query model selection that was still hard-coded in current usage.

### Fix

The current pass implemented the following:
- split `sideQuery()` into:
  - Claude path using the existing Anthropic client flow
  - non-Claude path using `queryModelWithoutStreaming()`
- converted side-query input messages into the internal message format expected by the shared provider path
- mapped provider-backed side-query responses back into a `BetaMessage`-compatible object for current callers
- preserved side-query analytics/timestamp logging for the provider-backed path
- added `stopSequences` to shared request options and forwarded it to the OpenAI-compatible adapter as `stop`
- changed memory relevance selection to use `getSmallFastModel()` instead of a hard-coded Claude Sonnet default

### Verification

Repository-level verification confirmed:
- `sideQuery()` now branches on active provider instead of always instantiating an Anthropic client
- non-Claude side-query requests now flow through `queryModelWithoutStreaming()`
- OpenAI-compatible request construction now accepts side-query stop sequences
- `findRelevantMemories()` no longer hard-codes a Claude Sonnet model for side-query selection

### Remaining Follow-up

The highest-value remaining audit item after this pass is narrower than before:
- some side-query call sites may still choose Claude-oriented helper models or prompts even though the transport path is now provider-aware

This is no longer a provider-boundary break in the same sense as before; it is now a call-site policy audit around model selection and capability expectations.

## 2026-04-01 Debug Record: sideQuery Call-Site Audit

### Symptom

After migrating `sideQuery()` itself, the remaining risk shifted to individual call sites:
- some side-query-based workflows still selected models from Claude-centric override channels
- some Anthropic-only feature surfaces still exposed side-query-backed behavior without a provider guard

The highest-signal examples found in this pass were:
- auto-mode classifier override model selection
- Claude in Chrome setup and command exposure

### Root Cause

Provider abstraction fixed the transport boundary first, but some call-site policy still assumed a Claude-oriented runtime:
- auto-mode classifier overrides could still come from Claude-specific env / GrowthBook values
- Claude in Chrome remained gated by subscription state, but not by provider capability

### Decision

Keep the current call-site model-selection behavior where it is provider-compatible, but reject incompatible overrides instead of letting them fail deep inside the provider path.

Also treat Claude in Chrome as Anthropic-only at its actual feature entry points, not only by implication.

### Fix

The current pass implemented the following:
- updated `getClassifierModel()` in `yoloClassifier.ts` to validate override candidates against the active provider before using them
- when a classifier override is incompatible with the active provider, it now logs a warning and falls back to the main loop model
- added an Anthropic-provider assertion inside Claude in Chrome setup
- disabled the `/chrome` command when the active provider does not support Claude OAuth/session features
- added a provider-aware `--chrome` guard so the flag is ignored with an explicit message outside the Claude provider

### Verification

Repository-level verification confirmed:
- auto-mode classifier override selection now uses provider-model compatibility checks before accepting env / GrowthBook overrides
- Claude in Chrome setup now throws immediately if reached under a non-Claude provider
- `/chrome` command visibility now depends on provider capability
- `--chrome` startup handling now reports provider incompatibility instead of silently attempting setup

### Remaining Follow-up

The remaining side-query call-site audit is now smaller and lower risk:
- `permissionExplainer`, `agenticSessionSearch`, and `autoModeCritique` currently look acceptable with the migrated transport path
- broader Anthropic-only audits still remain for features adjacent to Claude-in-Chrome and other subscription-specific integrations

## 2026-04-01 Debug Record: Shared Options Strategy For OpenAI-Compatible Providers

### Symptom

After the main provider routing work stabilized, the highest remaining compatibility ambiguity moved to the shared `Options` contract inherited from the Claude-centric query path.

The current issue is not that every field is broken; it is that several fields do not yet have an explicit provider policy for `openai` / `azure-openai`.

### Decision

Treat the remaining `Options` fields in three categories:
- `supported and mapped`
- `accepted but intentionally ignored`
- `Claude-only / capability-gated`

This keeps the adapter surface predictable and avoids silent semantic drift.

### Proposed Strategy

1. Supported and mapped now or in the near term

- `maxOutputTokensOverride`
  Keep supported. Already maps to OpenAI-compatible `max_tokens`.

- `temperatureOverride`
  Keep supported. Already maps directly.

- `stopSequences`
  Keep supported. Already maps to OpenAI-compatible `stop`.

- `toolChoice`
  Keep supported. Already translated to OpenAI-compatible tool choice.

- `extraToolSchemas`
  Keep supported on a best-effort basis for function-style schemas only.

- `outputFormat`
  Keep supported where the request is using text or tool-structured output patterns that the OpenAI-compatible adapter can honor. Treat this as supported for current side-query/non-streaming helper use, but continue to verify call-site expectations during validation.

2. Accepted but intentionally ignored for OpenAI-compatible providers

- `enablePromptCaching`
  Accept but ignore.
  Reason: OpenAI-compatible adapters in this change do not expose Anthropic prompt-cache semantics.

- `skipCacheWrite`
  Accept but ignore at the provider transport layer.
  Reason: this influences Anthropic prompt-cache markers, not OpenAI-compatible request semantics.

- `hasPendingMcpServers`
  Accept but ignore.
  Reason: this currently gates Anthropic-specific advisor/server-side behavior rather than a generic provider transport behavior.

- `fetchOverride`
  Best strategy for this phase: accept but ignore, and document that OpenAI-compatible adapters currently use native `fetch`.
  Reason: supporting it correctly means threading a custom fetch implementation through every provider adapter call path rather than only the Claude client path.

- `onStreamingFallback`
  Accept but ignore for OpenAI-compatible providers in the current phase.
  Reason: the current OpenAI-compatible path does not implement the same streaming-to-nonstreaming fallback lifecycle as the Claude path.

3. Claude-only / capability-gated

- `advisorModel`
  Treat as Claude-only for now.
  Reason: current behavior is tied to Anthropic-oriented server-side advisor tool semantics, not a generic provider tool abstraction.

- `taskBudget`
  Treat as Claude-only for now.
  Reason: current implementation depends on Anthropic `output_config.task_budget`; no equivalent provider-neutral mapping exists yet in this change.

### Recommended Enforcement Policy

For OpenAI-compatible adapters:
- continue to support fields already translated (`maxOutputTokensOverride`, `temperatureOverride`, `stopSequences`, `toolChoice`, compatible `extraToolSchemas`)
- explicitly ignore `enablePromptCaching`, `skipCacheWrite`, `hasPendingMcpServers`, `fetchOverride`, and `onStreamingFallback`
- capability-gate or no-op `advisorModel` and `taskBudget` rather than pretending they are generic transport features

### Current Assessment

This strategy is sufficient for the current phase because it:
- preserves the meaningful cross-provider options
- avoids claiming parity where no parity exists
- narrows future remediation to a smaller number of consciously unsupported features instead of a fuzzy compatibility surface

## 2026-04-01 Debug Record: OpenAI-Compatible Options Enforcement

### Symptom

The previous strategy pass clarified how remaining shared `Options` fields should be treated, but the adapter behavior was still partly implicit.

That meant OpenAI-compatible providers could still ignore Claude-era fields without any clear runtime signal, which keeps debugging ambiguous.

### Decision

Implement the strategy as explicit adapter behavior:
- keep the already-supported translated options working
- log once when OpenAI-compatible providers intentionally ignore a Claude-specific or unsupported option
- keep Azure aligned with the same policy as the shared OpenAI-compatible adapter base

### Fix

The current pass implemented the following:
- added explicit ignored-option reporting in the OpenAI-compatible adapter
- the adapter now warns once per provider/option when it ignores:
  - `fetchOverride`
  - `onStreamingFallback`
  - `enablePromptCaching`
  - `skipCacheWrite`
  - `hasPendingMcpServers`
  - `advisorModel`
  - `taskBudget`
- kept the already-supported translated options in place:
  - `maxOutputTokensOverride`
  - `temperatureOverride`
  - `stopSequences`
  - `toolChoice`
  - compatible `extraToolSchemas`
- aligned Azure OpenAI with the same explicit option policy by overriding the provider label used in those warnings

### Verification

Repository-level verification confirmed:
- ignored Claude-specific/shared options are now surfaced explicitly in the OpenAI-compatible adapter path
- Azure OpenAI inherits the same ignore/gate behavior with provider-specific labeling
- the supported translated options remain mapped in the request body rather than being downgraded by this change

## 2026-04-01 Debug Record: Task-State Verification Rollback

### Symptom

During a follow-up verification pass focused on task accuracy rather than code-path review, several validation tasks still appeared overstated:
- `provider-abstraction/tasks.md` marked validation items `2.3` and `4.3` complete without tooling-backed execution evidence in the current repository state
- `azure-openai-provider/tasks.md` marked `4.2` complete even though the current environment still could not execute the Bun-based test file
- the existing Azure diagnostics tests did not fully match the current diagnostics implementation, which means at least part of the capability-validation surface is still unresolved

### Root Cause

Two issues were present:
- task bookkeeping had drifted ahead of executable validation evidence
- Azure validation expectations in `src/services/providers/azure.test.ts` had diverged from the current diagnostics contract in `src/services/providers/diagnostics.ts`

### Decision

Keep implementation tasks complete where code is present, but roll validation tasks back to incomplete until they are supported by executed automation and reconciled test expectations.

### Fix

The OpenSpec task state was corrected as follows:
- `provider-abstraction 2.3` -> incomplete
- `provider-abstraction 4.3` -> incomplete
- `azure-openai-provider 4.2` -> incomplete

### Verification

Repository review confirmed:
- no Anthropic-compatible provider validation suite was identified alongside the adapter changes
- the only focused provider test file currently present is `src/services/providers/azure.test.ts`
- local execution tooling remains unavailable in this environment:
  - `bun` not installed
  - `tsc` not installed
- current Azure diagnostics tests expect fields that do not match the current implementation contract exactly, so validation cannot be treated as cleanly closed yet

## 2026-04-01 Debug Record: Mirror Recovery and Dependency Backfill

### Symptom

`bun test src/services/providers/azure.test.ts` could not reach the provider assertions because the mirrored repository was missing a mix of source files and package metadata.

### Fix

Recovered the minimum source/runtime surface needed to continue validation:
- added `src/types/connectorText.ts`
- added `src/tools/TungstenTool/TungstenTool.ts`
- added `src/entrypoints/sdk/runtimeTypes.ts`
- added `src/entrypoints/sdk/coreTypes.generated.ts`
- added `src/entrypoints/sdk/settingsTypes.generated.ts`
- added `src/entrypoints/sdk/toolTypes.ts`
- added `src/entrypoints/sdk/sdkUtilityTypes.ts`

Backfilled package installs needed to keep the test chain moving:
- `lru-cache`
- `@growthbook/growthbook`
- `react`
- `lodash-es`
- `chalk`
- `diff`
- `@opentelemetry/api`
- `@opentelemetry/resources`
- `@opentelemetry/sdk-logs`
- `@opentelemetry/semantic-conventions`
- `@modelcontextprotocol/sdk`
- `@anthropic-ai/sandbox-runtime`
- `https-proxy-agent`
- `@opentelemetry/core`

### Verification

The test runner progressed through several distinct blockers after each recovery step:
- missing `connectorText` source
- missing package metadata for `lru-cache`
- missing `lodash-es/memoize.js`
- missing `chalk`
- missing `diff`
- missing OpenTelemetry packages
- missing `TungstenTool`
- missing SDK runtime-generated types
- missing `https-proxy-agent`

The current state is improved, but `azure.test.ts` is still not at the provider assertion stage.

## 2026-04-01 Debug Record: Dependency Backfill and Local Redirect

### Fix

Additional packages were backfilled to keep source-level validation moving:
- `get-stream`
- `which`
- `@anthropic-ai/sdk`
- `zod`
- `human-signals`
- `ajv-formats`
- `cssfilter`
- `debug`
- `agent-base`
- `eventsource`
- `eventsource-parser`
- `pkce-challenge`
- `@alcalzone/ansi-tokenize`
- `chokidar`
- `signal-exit`
- `usehooks-ts`
- `color-diff-napi` was not usable as published, so the structured diff path was redirected to the local TypeScript port in `src/native-ts/color-diff/index.ts`
- `readdirp`
- `react-reconciler`
- `zod-to-json-schema`
- `@pondwader/socks5-server`
- `@sec-ant/readable-stream`
- `form-data`
- `combined-stream`
- `delayed-stream`
- `code-excerpt`
- `bidi-js`
- `convert-to-spaces`
- `cli-boxes`
- `scheduler`

Additional source recovery was also added:
- `src/ink/global.d.ts`

### Verification

`bun test src/services/providers/azure.test.ts` now passes end-to-end:
- 31 passing tests
- 0 failures
- provider stream translation, auth/error normalization, and Azure diagnostics all match the expected contract

## 2026-04-01 Dependency Recovery Ledger

This mirrors the current recovery work only. It is not a formal dependency manifest yet.

### Runtime packages backfilled

- `get-stream`
- `which`
- `@anthropic-ai/sdk`
- `zod`
- `human-signals`
- `ajv-formats`
- `cssfilter`
- `debug`
- `agent-base`
- `eventsource`
- `eventsource-parser`
- `pkce-challenge`
- `@alcalzone/ansi-tokenize`
- `chokidar`
- `signal-exit`
- `usehooks-ts`
- `readdirp`
- `react-reconciler`
- `zod-to-json-schema`
- `@pondwader/socks5-server`
- `@sec-ant/readable-stream`
- `form-data`
- `combined-stream`
- `delayed-stream`
- `code-excerpt`
- `bidi-js`
- `convert-to-spaces`
- `cli-boxes`
- `scheduler`
- `lru-cache`
- `@growthbook/growthbook`
- `react`
- `lodash-es`
- `chalk`
- `diff`
- `@opentelemetry/api`
- `@opentelemetry/resources`
- `@opentelemetry/sdk-logs`
- `@opentelemetry/semantic-conventions`
- `@opentelemetry/api-logs`
- `@opentelemetry/core`
- `@modelcontextprotocol/sdk`
- `@anthropic-ai/sandbox-runtime`
- `https-proxy-agent`
- `eventsource`
- `eventsource-parser`
- `ajv`
- `dom-mutator`
- `xss`

### Source recovery / local redirects

- `src/types/connectorText.ts`
- `src/tools/TungstenTool/TungstenTool.ts`
- `src/entrypoints/sdk/runtimeTypes.ts`
- `src/entrypoints/sdk/coreTypes.generated.ts`
- `src/entrypoints/sdk/settingsTypes.generated.ts`
- `src/entrypoints/sdk/toolTypes.ts`
- `src/entrypoints/sdk/sdkUtilityTypes.ts`
- `src/ink/global.d.ts`
- `src/tools/WorkflowTool/constants.ts`
- `src/components/StructuredDiff/colorDiff.ts` now redirects to the local TypeScript color-diff port in `src/native-ts/color-diff/index.ts`

## 2026-04-02 Review Summary: provider-selection-ux Implementation

All 12 tasks in `provider-selection-ux/tasks.md` were implemented in this session.

### Changes Implemented

**1. Provider Selection Precedence (`src/services/providers/config.ts`)**

Replaced the previous env-only provider resolution with a full multi-source precedence chain:
- `--provider` CLI flag (parsed from `process.argv` via `eagerParseCliFlag`)
- `settings.provider` (read via `getSettings_DEPRECATED()`)
- `CLAUDE_CODE_PROVIDER` env var
- Legacy Anthropic-compatible env vars (`CLAUDE_CODE_USE_BEDROCK/VERTEX/FOUNDRY`) — still map to `claude`
- Default: `claude`

Added `warnProviderConflict()` to emit a stderr diagnostic when two explicit sources disagree. Conflict detection covers all three pairs: CLI vs env, CLI vs settings, env vs settings.

The `resolveActiveProvider()` function now guarantees exactly one provider is selected before any model resolution runs.

**2. Provider-Model Compatibility Validation (`src/services/providers/validate.ts`)**

Added `validateProviderModelCombination(config, model)` which rejects Claude-specific model strings and aliases when the active provider is `openai` or `azure-openai`. Detection covers:
- Claude family aliases: `sonnet`, `opus`, `haiku`, `best`, `opusplan`, `sonnet[1m]`, `opus[1m]`
- Full Anthropic model IDs: strings starting with `claude-`
- Cross-region Bedrock/Vertex prefixes: `us.anthropic.*`, `eu.anthropic.*`, `ap.anthropic.*`

`assertProviderConfigValid()` updated to accept an optional `model` parameter so provider-model validation runs in the same startup throw path as credential validation.

`validateProviderModelCombination` exported from `src/services/providers/index.ts` for external use.

**3. Startup Model Validation (`src/main.tsx`)**

Updated the `assertProviderConfigValid()` call at startup to pass `userSpecifiedModel` so a Claude alias like `sonnet` combined with `CLAUDE_CODE_PROVIDER=openai` is caught and reported before the first request, not inside the inference path.

**4. Diagnostics Fields (`src/services/providers/types.ts`, `diagnostics.ts`)**

Added two new fields to `ProviderDiagnostics`:
- `resolvedModel`: human-readable model or deployment target per provider; reflects the configured env var or indicates runtime alias resolution for Claude
- `credentialSource`: describes auth method without exposing secrets (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY (missing)`, `DefaultAzureCredential (Entra ID)`)

`formatProviderDiagnostics()` updated to include both new fields in its formatted output.

**5. Status Display (`src/utils/status.tsx`)**

`buildAPIProviderProperties()` updated to include:
- `Model / Deployment` row from `diagnostics.resolvedModel`
- `Credentials` row from `diagnostics.credentialSource`

These appear in the `/status` Settings → Provider tab.

**6. Improved Error Messages (`src/services/providers/config.ts`)**

Validation errors for OpenAI and Azure OpenAI rewritten to be provider-generic (not assuming the env var as the only source):
- OpenAI: "OpenAI provider requires an API key. Set OPENAI_API_KEY..."
- Azure: "Azure OpenAI provider requires an endpoint URL. Set AZURE_OPENAI_ENDPOINT..."

Error messages now lead with the provider name and what is missing rather than leading with the env var name.

**7. Legacy Path Verification**

Legacy Anthropic-compatible paths (`CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`) were confirmed unchanged: they fall through `resolveActiveProvider()` to the `'claude'` default and are handled inside the claude adapter sub-path. No migration action needed.

### Validation Notes

Code-path verification confirmed:
- provider config now reads `--provider` flag, settings, and env in documented precedence order
- conflict detection logic covers all three source pairs
- provider-model validation fires at startup with the resolved model target
- diagnostics now include resolved model and credential source
- status output now shows model/deployment and credential rows

Automated test execution was not performed in this session (same environment constraints as prior passes — no `bun`, no `tsc`).

### Remaining Follow-up

None for `provider-selection-ux` tasks. All 12 tasks marked complete.

Broader follow-up from earlier changes that remains open:
- automated validation of provider tests in an environment with `bun` available
- Anthropic-only feature entry-point audit (beyond the highest-visibility entry points already gated)

## 2026-04-02 Debug Record: Final Provider Review Remediation

### Symptom

Final review identified two remaining closure issues after the three provider-related changes had been marked complete:
- non-Claude providers still passed model/deployment values through the existing global `availableModels` allowlist path, which is Claude-oriented and can reject valid Azure deployment names
- `provider-abstraction` claimed OpenAI-compatible validation completion, but the repository still lacked a focused `OpenAIAdapter` test file covering direct OpenAI request construction and fallback behavior

### Root Cause

The allowlist logic in `src/utils/model/modelAllowlist.ts` still applied Claude-family alias and version-prefix semantics generically, regardless of active provider.

At the same time, existing automated coverage validated Azure OpenAI and provider-selection behavior, but not the OpenAI adapter directly.

### Decision

Keep the existing enterprise `availableModels` restriction, but make its interpretation provider-aware:
- `claude` keeps the current alias/family/version-prefix semantics
- `openai` and `azure-openai` use exact-match allowlist behavior so provider-native model IDs or deployment names are not filtered through Claude-oriented alias rules

Also close the validation gap by adding a focused OpenAI adapter test file instead of treating Azure coverage as a sufficient proxy.

### Fix

The remediation pass implemented the following:
- added `isModelAllowedForProvider()` in `src/utils/model/modelAllowlist.ts`
- changed non-Claude allowlist behavior to exact-match against configured values instead of Claude alias/family expansion
- updated `validateModel()` to call provider-aware allowlist logic before provider-specific compatibility checks
- updated the `/model` command path to use provider-aware allowlist checks before validating and applying a model override
- added `src/services/providers/openai.test.ts` with focused coverage for:
  - configured base URL handling
  - bearer authentication headers
  - normalized streaming event emission
  - tool-calling rejection fallback to a no-tool retry
  - network-error normalization into `SystemAPIErrorMessage`
  - capability reporting when tools are disabled

### Verification

Executed automated tests:
- `bun test src/services/providers/openai.test.ts`
- `bun test src/services/providers/azure.test.ts`
- `bun test src/services/providers/provider-selection.test.ts`
- `bun test src/cli/handlers/auth.test.ts`
- combined run: `bun test src/services/providers/openai.test.ts src/services/providers/azure.test.ts src/services/providers/provider-selection.test.ts src/cli/handlers/auth.test.ts`

Observed result:
- 42 passing tests
- 0 failures

Executed TypeScript validation:
- `bunx --bun tsc --noEmit -p tsconfig.json`
  - failed immediately on `tsconfig.json` deprecation gating under TypeScript 6: `baseUrl` now requires explicit deprecation acknowledgement
- `bunx --bun tsc --noEmit -p tsconfig.json --ignoreDeprecations 6.0`
  - still failed due to broad repository baseline issues unrelated to this remediation pass, including missing global types, missing declaration files, missing runtime type packages, and existing compile errors outside the provider files touched here

### Current Assessment

After this remediation pass:
- the provider/model allowlist path is aligned with provider-aware model/deployment semantics
- OpenAI adapter behavior now has direct automated coverage alongside the existing Azure and provider-selection suites
- provider-focused automated validation is materially stronger than in the prior review state

TypeScript no-emit remains a repository-level baseline issue rather than a newly introduced failure from this change.

## 2026-04-02 Debug Record: Anthropic-Compatible Validation Closure

### Symptom

After the final remediation pass, `provider-abstraction/tasks.md` item `2.3` still remained open because there was no focused automated validation proving that the adapter refactor had preserved Anthropic-compatible provider routing.

### Decision

Use a narrow regression suite for the Claude adapter boundary rather than attempting live credential-backed requests:
- verify that legacy Bedrock / Vertex / Foundry env selections still resolve through the Claude adapter path
- verify that the Claude adapter still exposes Anthropic-only capabilities
- verify that the adapter remains a direct passthrough to `queryModelWithStreaming`, which is the intended zero-behavior-change contract for existing Anthropic-compatible providers

This closes the adapter-refactor validation gap without introducing brittle credential-dependent tests.

### Fix

Added `src/services/providers/claude.test.ts` covering:
- default `firstParty` provider resolution
- legacy `CLAUDE_CODE_USE_BEDROCK`
- legacy `CLAUDE_CODE_USE_VERTEX`
- legacy `CLAUDE_CODE_USE_FOUNDRY`
- Claude adapter capability flags
- direct `executeRequest === queryModelWithStreaming` passthrough verification

### Verification

Executed automated tests:
- `bun test src/services/providers/claude.test.ts`
- `bun test src/services/providers/claude.test.ts src/services/providers/openai.test.ts src/services/providers/azure.test.ts src/services/providers/provider-selection.test.ts src/cli/handlers/auth.test.ts`

Observed result:
- 45 passing tests
- 0 failures

### Current Assessment

With the Claude adapter regression suite now present, the focused validation requirement for Anthropic-compatible providers is sufficiently covered for the adapter refactor scope.

`provider-abstraction/tasks.md` item `2.3` is now aligned with the executed validation state.

## 2026-04-02 Debug Record: TypeScript Baseline Triage

### Symptom

Repository-level `tsc --noEmit` could not be used as a reliable validation step:
- TypeScript 6 rejected the current `tsconfig.json` because `baseUrl` now requires explicit deprecation acknowledgement
- after bypassing the TS6 deprecation gate, the source tree still failed on a mix of missing global types, missing declaration packages, and missing source entrypoints in the reconstructed tree

At the same time, the bundled `cli.js` remained runnable, which indicated that the shipped runtime bundle was intact even though the reconstructed source tree was not yet type-checkable.

### Decision

Treat the TypeScript work as a separate baseline-repair pass rather than folding it into the already-completed provider changes.

The repair strategy for this pass was:
- first restore TS6/tooling compatibility so `tsc` can run meaningfully
- then add narrow source-compatible shims for obviously missing entrypoints in the reconstructed tree
- use the resulting error surface to separate "missing reconstructed source pieces" from "real source-level type errors"

This intentionally prioritizes diagnosability over strictness in the shim files.

### Fix

Tooling baseline updates:
- updated `tsconfig.json` to add:
  - `ignoreDeprecations: "6.0"`
  - explicit `lib` entries
  - explicit `types` entries for Node/Bun compile-time globals
- added compile-time dev dependencies in `package.json` / `bun.lock`:
  - `typescript`
  - `@types/node`
  - `@types/react`
  - `@types/react-dom`
  - `@types/lodash-es`
  - `bun-types`

Reconstructed-source shim entrypoints added:
- `src/global.d.ts`
- `src/types/message.ts`
- `src/entrypoints/sdk/controlTypes.ts`
- `src/services/oauth/types.ts`
- `src/assistant/index.ts`
- `src/commands/workflows/index.ts`
- `src/cli/transports/Transport.ts`
- `src/proactive/index.ts`
- `src/services/compact/reactiveCompact.ts`
- `src/services/contextCollapse/index.ts`
- `src/services/contextCollapse/operations.ts`
- `src/services/skillSearch/localSearch.ts`
- `src/commands/peers/index.ts`
- `src/commands/fork/index.ts`
- `src/commands/buddy/index.ts`
- `src/tools/WorkflowTool/createWorkflowCommand.ts`
- `src/utils/attributionHooks.ts`

SDK entrypoint re-exports were also backfilled in `src/entrypoints/agentSdkTypes.ts` so the reconstructed tree exposes the type names referenced across CLI/bridge code.

### Verification

Executed TypeScript validation iteratively:
- `./node_modules/.bin/tsc --noEmit -p tsconfig.json --pretty false`

Observed progression:
- initial failures were dominated by TS6 config gating, missing Node/React/Bun globals, missing declaration packages, and missing source entrypoints
- after the baseline/tooling updates and shim entrypoints, those environment-level and missing-file failures were materially reduced
- remaining first-page failures shifted primarily to real source-level typing issues in:
  - `src/bridge/*`
  - `src/cli/print.ts`
  - various command/UI files with `unknown`, `never`, and implicit-`any` problems

### Current Assessment

This pass established a usable TypeScript triage baseline:
- `tsc` now reflects the reconstructed source tree's real typing problems much more directly
- the repository is no longer blocked first by TS6 config incompatibility or the most obvious missing-source entrypoints
- the next repair phase should focus on actual type fixes, starting with the bridge transport/control-message files that now dominate the first-screen error output

The bundled runtime remaining executable is consistent with this state: the runtime bundle is valid, but the reconstructed source tree still needs targeted type repair before repository-level `tsc --noEmit` can pass.

### Progress Update

Follow-up type-repair work has now removed another layer of non-business-logic failures:
- restored `src/cli/handlers/util.tsx` as readable source instead of leaving the reconstructed tree with a deleted handler module
- repaired bridge-side type flow in:
  - `src/bridge/bridgeMessaging.ts`
  - `src/bridge/inboundMessages.ts`
  - `src/bridge/remoteBridgeCore.ts`
  - `src/bridge/replBridge.ts`
- cleaned low-cost transport/cache/task typing issues in:
  - `src/cli/transports/WebSocketTransport.ts`
  - `src/commands/clear/caches.ts`
  - `src/commands/clear/conversation.ts`
  - `src/tools/TungstenTool/TungstenTool.ts`
- restored `src/buddy/useBuddyNotification.tsx` to maintainable handwritten React/TypeScript source

Re-running:
- `./node_modules/.bin/tsc --noEmit -p tsconfig.json --pretty false`

now shows the first-screen failures concentrated in:
- `src/buddy/CompanionSprite.tsx`
- `src/cli/print.ts`
- `src/commands/bridge/bridge.tsx`

This confirms the baseline-repair phase is substantially complete. The remaining work is dominated by real source typing problems in larger reconstructed UI/command files rather than missing entrypoints or obvious environment/tooling gaps.

### Ongoing TSC Repair Progress

The next pass continued shrinking the first-screen TypeScript surface by fixing high-yield command files before moving into larger feature groups:
- removed the remaining first-screen errors in:
  - `src/commands/fast/fast.tsx`
  - `src/commands/ide/ide.tsx`
  - `src/commands/copy/copy.tsx`
- normalized `fs/promises.readdir()` usage in `src/commands/insights.ts` to explicit `Dirent<string>[]` handling, which cleared the reconstructed-source `NonSharedBuffer` path/type mismatches

After these repairs, the dominant remaining first-screen failures are no longer in the earlier bridge/print/fast/ide/copy/insights set. The error surface has moved primarily into:
- `src/commands/install-github-app/*`
- `src/commands/install.tsx`
- `src/commands/login/login.tsx`

This is the expected progression: the repository is now past the earlier baseline/tooling/bridge-command bottlenecks and into the next cluster of command-specific typing fixes.

### Additional Command Cleanup

Another repair pass removed several more first-screen command clusters:
- `src/commands/install.tsx`
- `src/commands/login/login.tsx`
- the full `src/commands/install-github-app/*` group
- `src/commands/mcp/*`
- `src/commands/mobile/mobile.tsx`
- `src/commands/model/model.tsx`

Key changes in this phase:
- added reconstructed shared typings for the GitHub App flow in `src/commands/install-github-app/types.ts`
- restored missing ambient module declarations for `execa` and `@commander-js/extra-typings` in `src/global.d.ts`
- typed React component props and state selectors across command files so `setState` / `useAppState` callbacks no longer collapse to implicit `any` / `unknown`

This confirms that the current TSC surface has moved beyond the earlier command groups and is now concentrated in the larger plugin-management area.

### Plugin Cluster And Next Frontiers

The next repair pass closed the remaining first-screen plugin-management cluster:
- tightened shared plugin/MCP item typing in:
  - `src/commands/plugin/unifiedTypes.ts`
- completed focused typing cleanup in:
  - `src/commands/plugin/ManagePlugins.tsx`
  - `src/commands/plugin/DiscoverPlugins.tsx`
  - `src/commands/plugin/PluginOptionsDialog.tsx`
  - `src/commands/plugin/PluginSettings.tsx`
  - `src/commands/plugin/UnifiedInstalledCell.tsx`
  - `src/commands/plugin/ValidatePlugin.tsx`

This removed the earlier `plugin` first-screen blockers (`unknown` plugin/MCP payloads, implicit `any` callback parameters, and nullable state inference issues). After re-running:
- `./node_modules/.bin/tsc --noEmit -p tsconfig.json --pretty false`

the first-screen errors have advanced again and are now concentrated in the next command set:
- `src/commands/rate-limit-options/rate-limit-options.tsx`
- `src/commands/remote-setup/remote-setup.tsx`
- `src/commands/resume/resume.tsx`
- `src/commands/review/*`
- `src/commands/session/session.tsx`
- `src/commands/tag/tag.tsx`

Follow-up cleanup has already started on that next layer by:
- typing `src/commands/rate-limit-options/rate-limit-options.tsx` component props/state and select handlers
- narrowing the local `execa` call shape and select callback typing in `src/commands/remote-setup/remote-setup.tsx`

At this point the TypeScript repair effort is no longer blocked by plugin management. The remaining work is primarily repetitive command/component typing cleanup across the reconstructed UI surface.

### Agents Wizard And Shared Wizard Types

The latest TSC pass moved the first-screen frontier into the reconstructed agent-management UI, especially the interactive `/agents` menu and the new-agent wizard flow.

Completed in this pass:
- restored missing shared wizard typings in:
  - `src/components/wizard/types.ts`
- restored missing agent wizard state typing in:
  - `src/components/agents/new-agent-creation/types.ts`
- repaired the agent-management surface enough to move past the earlier top-level menu/list issues:
  - `src/components/agents/AgentDetail.tsx`
  - `src/components/agents/AgentNavigationFooter.tsx`
  - `src/components/agents/AgentsList.tsx`
  - `src/components/agents/AgentsMenu.tsx`
  - `src/components/agents/ColorPicker.tsx`
  - `src/components/agents/ModelSelector.tsx`
  - `src/components/agents/AgentEditor.tsx`
  - `src/components/agents/generateAgent.ts`
- reintroduced explicit wizard generics and state typing across the new-agent flow:
  - `src/components/agents/new-agent-creation/CreateAgentWizard.tsx`
  - `src/components/agents/new-agent-creation/wizard-steps/ColorStep.tsx`
  - `src/components/agents/new-agent-creation/wizard-steps/DescriptionStep.tsx`
  - `src/components/agents/new-agent-creation/wizard-steps/LocationStep.tsx`
  - `src/components/agents/new-agent-creation/wizard-steps/MemoryStep.tsx`
  - `src/components/agents/new-agent-creation/wizard-steps/MethodStep.tsx`
  - `src/components/agents/new-agent-creation/wizard-steps/ModelStep.tsx`
  - `src/components/agents/new-agent-creation/wizard-steps/PromptStep.tsx`
  - `src/components/agents/new-agent-creation/wizard-steps/ToolsStep.tsx`
  - `src/components/agents/new-agent-creation/wizard-steps/TypeStep.tsx`
  - `src/components/agents/new-agent-creation/wizard-steps/ConfirmStep.tsx`

After re-running:
- `./node_modules/.bin/tsc --noEmit -p tsconfig.json --pretty false`

the error surface is no longer dominated by missing wizard modules or broad `unknown` propagation from `useWizard()`. The remaining first-screen issues in this area are now much narrower:
- a few concrete `new-agent-creation` value-shape mismatches (`ColorStep`, `MemoryStep`, `ConfirmStep`, `ConfirmStepWrapper`)
- the next major cluster in `src/components/agents/ToolSelector.tsx`
- then broader reconstructed `src/components/*` typing cleanup

This confirms another phase change in the repair work: the agent wizard is now past its missing-type-definition stage and into ordinary component-level typing fixes.

### Map-Backed Recovery Pass

I then verified that `cli.js.map` contains valid `sourcesContent` for the reconstructed UI sources and used it as the ground truth for a small set of confirmed-bad files.

Files rewritten directly from the map:
- `src/components/design-system/ProgressBar.tsx`
- `src/components/design-system/StatusIcon.tsx`
- `src/components/LogoV2/Clawd.tsx`

Validation:
- Re-ran `./node_modules/.bin/tsc --noEmit -p tsconfig.json --pretty false`
- The frontier moved past those restored files and is now concentrated in the next parse-error cluster, primarily:
  - `src/components/DesktopHandoff.tsx`
  - `src/components/diff/DiffDialog.tsx`
  - `src/components/mcp/ElicitationDialog.tsx`
  - `src/components/messages/AssistantRedactedThinkingMessage.tsx`
  - `src/components/messages/AssistantThinkingMessage.tsx`

This is a stronger signal than the earlier type-only cleanup passes: the remaining work is now a mix of genuine source corruption and deeper component-level repairs, not just missing props or implicit `any` annotations.

### Parse Frontier Cleared

I continued the map-backed recovery pass and rewrote the next set of confirmed-bad files directly from `cli.js.map`:
- `src/components/DesktopHandoff.tsx`
- `src/components/diff/DiffDialog.tsx`
- `src/components/mcp/ElicitationDialog.tsx`
- `src/components/messages/AssistantRedactedThinkingMessage.tsx`
- `src/components/messages/AssistantThinkingMessage.tsx`
- `src/components/messages/AssistantToolUseMessage.tsx`
- `src/components/messages/UserTeammateMessage.tsx`
- `src/components/ModelPicker.tsx`
- `src/components/permissions/AskUserQuestionPermissionRequest/QuestionNavigationBar.tsx`
- `src/components/PromptInput/PromptInputFooterLeftSide.tsx`
- `src/components/PromptInput/PromptInputFooterSuggestions.tsx`
- `src/components/Spinner/SpinnerGlyph.tsx`
- `src/components/Spinner/TeammateSpinnerTree.tsx`
- `src/components/Stats.tsx`
- `src/components/tasks/ShellDetailDialog.tsx`
- `src/components/TeleportProgress.tsx`
- `src/components/TeleportRepoMismatchDialog.tsx`

After that pass, `tsc --noEmit -p tsconfig.json --pretty false` no longer reported parse/unclosed-JSX failures in those files. The frontier has now shifted into ordinary type mismatches and implicit-`any` cleanup in the next layer of components.

### Type-Only Frontier

I then started the next cleanup pass on the now-stable source tree:
- added explicit parameter types to `ApproveApiKey`, `AutoModeOptInDialog`, and `AutoUpdaterWrapper`
- fixed the `useState<boolean | null>` typing in `AutoUpdaterWrapper`
- tightened `AwsAuthStatusBox` and `BaseTextInput` helper/callback types

The current `tsc` frontier is now dominated by standard type mismatches rather than encoding or JSX parse damage. The highest-signal remaining files are:
- `src/commands/privacy-settings/privacy-settings.tsx`
- `src/components/AutoUpdater.tsx`
- `src/components/BashModeProgress.tsx`
- `src/components/BridgeDialog.tsx`
- `src/components/BypassPermissionsModeDialog.tsx`
- `src/components/ClaudeInChromeOnboarding.tsx`
- `src/components/ClaudeMdExternalIncludesDialog.tsx`
- `src/components/ConsoleOAuthFlow.tsx`
- `src/components/ContextVisualization.tsx`
- `src/components/CoordinatorAgentStatus.tsx`

### cli.js.map Inventory

To avoid repeatedly guessing whether a remaining error can be fixed by restoring original source, I added a reusable `cli.js.map` comparison step:
- `scripts/report-map-diff.mjs`
- `openspec/changes/cli-js-map-diff.md`

This compares every local `src/**/*.ts(x)` file against `cli.js.map` `sourcesContent` and classifies the result as missing, line-ending-only, mojibake/replacement-character corruption, or ordinary content drift.

Current result:
- local TypeScript sources now match `cli.js.map`
- remaining `tsc` errors are therefore not explained by map drift
- for the current frontier, direct map restoration is no longer expected to help; the remaining work is normal typing/signature repair

### Continued Type Baseline Recovery

I continued the repository-wide `tsc` cleanup with another focused batch aimed at pushing the first error screen deeper into the component tree:

- fixed `ContextVisualization` helper types and removed permanently-disabled JSX branches from active type-checking
- fixed `CtrlOToExpand`, `LoadingState`, `Ratchet`, `ThemedBox`, `ThemedText`, and `CustomSelect/select` typing gaps
- fixed `DesktopHandoff`, `DevBar`, `DevChannelsDialog`, and `DiagnosticsDisplay`
- restored missing `FeedbackSurvey` shared types in `src/components/FeedbackSurvey/utils.ts`
- fixed `DesktopUpsell/DesktopUpsellStartup`, `Feedback`, `FeedbackSurvey/useMemorySurvey`, and `FeedbackSurvey/usePostCompactSurvey`

After this pass, `tsc --noEmit -p tsconfig.json --pretty false` no longer reports:
- `ContextVisualization.tsx`
- `CtrlOToExpand.tsx`
- `LoadingState.tsx`
- `ThemedBox.tsx`
- `ThemedText.tsx`
- `DesktopHandoff.tsx`
- `DevBar.tsx`
- `DevChannelsDialog.tsx`
- `DiagnosticsDisplay.tsx`
- `DesktopUpsell/DesktopUpsellStartup.tsx`
- `Feedback.tsx`

The current first-screen frontier has now moved to:
- `src/components/diff/DiffDetailView.tsx`
- `src/components/diff/DiffDialog.tsx`
- `src/components/diff/DiffFileList.tsx`
- `src/components/EffortCallout.tsx`
- `src/components/ExitFlow.tsx`
- `src/components/FileEditToolDiff.tsx`
- `src/components/FileEditToolUpdatedMessage.tsx`
- `src/components/FileEditToolUseRejectedMessage.tsx`
- `src/components/FullscreenLayout.tsx`

Two remaining `FeedbackSurvey` files still require special handling:
- `src/components/FeedbackSurvey/FeedbackSurveyView.tsx`
- `src/components/FeedbackSurvey/TranscriptSharePrompt.tsx`

Those two files are not currently valid UTF-8 on disk, so `apply_patch` cannot update them directly. They should be restored from `cli.js.map` original text before further local type edits.

### Diff and FeedbackSurvey Cleanup

I restored additional encoding-damaged files from `cli.js.map` and used that to continue the next type-only cleanup wave:

- restored and fixed:
  - `src/components/FeedbackSurvey/FeedbackSurveyView.tsx`
  - `src/components/FeedbackSurvey/TranscriptSharePrompt.tsx`
  - `src/components/diff/DiffFileList.tsx`
- fixed typing/signatures in:
  - `src/components/diff/DiffDialog.tsx`
  - `src/components/diff/DiffDetailView.tsx` indirectly via `StructuredDiff`
  - `src/components/FileEditToolDiff.tsx`
  - `src/components/StructuredDiff.tsx`
  - `src/components/HighlightedCode.tsx`
  - `src/components/FileEditToolUpdatedMessage.tsx`
  - `src/components/ExitFlow.tsx`
  - `src/components/EffortCallout.tsx`

After this pass, the entire `diff/*`, `FeedbackSurvey/*`, `FileEditTool*`, `ExitFlow`, and `EffortCallout` groups dropped off the first `tsc` screen.

The current leading frontier is now concentrated in:
- `src/components/FullscreenLayout.tsx`
- `src/components/GlobalSearchDialog.tsx`

That is a useful boundary: the current work is no longer scattered across many small files. The next cleanup wave should focus on those two larger components first.

### Fullscreen, Search, Grove, and HighlightedCode Recovery

I continued from the `FullscreenLayout` / `GlobalSearchDialog` boundary and pushed the first `tsc` screen past those larger shared components:

- fixed `src/components/FullscreenLayout.tsx`
  - narrowed `stickyPrompt` state to `StickyPrompt | "clicked" | null`
  - added missing callback/helper parameter types
  - fixed helper component signatures for `NewMessagesPill` and `StickyPromptHeader`
- fixed `src/components/GlobalSearchDialog.tsx`
  - typed search state, preview state, abort/timeout refs, and list callback parameters
  - restored stable empty-array sentinels as typed arrays/tuples
  - typed the debounced ripgrep helper path
- fixed `src/components/grove/Grove.tsx`
  - widened `useState(null)` sites to real `boolean | null` / `GroveConfig | null`
  - typed dialog option values, input handlers, and exit-state renderers
- fixed `src/components/HelpV2/Commands.tsx` and `src/components/HelpV2/HelpV2.tsx`
  - removed implicit `any` callback parameters
  - typed memoized empty command arrays
- fixed `src/components/HighlightedCode.tsx`
  - typed DOM refs, line render callbacks, and `CodeLine` props
- restored `src/components/HighlightedCode/Fallback.tsx` from `cli.js.map` original text, then typed its props and highlight loader path

After this pass, `tsc --noEmit -p tsconfig.json --pretty false` no longer reports:
- `src/components/FullscreenLayout.tsx`
- `src/components/GlobalSearchDialog.tsx`
- `src/components/grove/Grove.tsx`
- `src/components/HelpV2/Commands.tsx`
- `src/components/HelpV2/HelpV2.tsx`
- `src/components/HighlightedCode.tsx`
- `src/components/HighlightedCode/Fallback.tsx`

The current first-screen frontier has now moved into the hooks configuration UI:
- `src/components/hooks/HooksConfigMenu.tsx`
- `src/components/hooks/PromptDialog.tsx`
- `src/components/hooks/SelectEventMode.tsx`
- `src/components/hooks/SelectHookMode.tsx`
- `src/components/hooks/SelectMatcherMode.tsx`

This is another good phase boundary: the remaining first-screen errors are now concentrated in one module family instead of shared layout/search/rendering components.

### Message Stack and Type Baseline Recovery

I continued the TypeScript baseline cleanup through the message rendering stack and used `cli.js.map` source restoration where encoding damage blocked direct patching.

- restored from `cli.js.map` and retyped:
  - `src/components/MessageResponse.tsx`
  - `src/components/messages/SystemAPIErrorMessage.tsx`
  - `src/components/messages/SystemTextMessage.tsx`
- fixed message rendering / lookups / progress typing in:
  - `src/components/MessageRow.tsx`
  - `src/components/Messages.tsx`
  - `src/components/messageActions.tsx`
  - `src/components/messages/AssistantToolUseMessage.tsx`
  - `src/components/messages/CollapsedReadSearchContent.tsx`
  - `src/components/messages/GroupedToolUseContent.tsx`
  - `src/components/messages/AttachmentMessage.tsx`
  - `src/components/messages/PlanApprovalMessage.tsx`
  - `src/components/messages/RateLimitMessage.tsx`
  - `src/components/messages/ShutdownMessage.tsx`
  - `src/components/messages/nullRenderingAttachments.ts`
- fixed message-specific helper/render components:
  - `src/components/messages/teamMemCollapsed.tsx`
  - `src/components/messages/UserBashOutputMessage.tsx`
  - `src/components/messages/UserLocalCommandOutputMessage.tsx`
  - `src/components/messages/UserResourceUpdateMessage.tsx`
  - `src/components/messages/UserTeammateMessage.tsx`
  - `src/components/messages/UserToolResultMessage/utils.tsx`
- added minimal missing shims so reconstructed imports can type-check:
  - `src/components/messages/UserGitHubWebhookMessage.tsx`
  - `src/components/messages/UserForkBoilerplateMessage.tsx`
  - `src/components/messages/UserCrossSessionMessage.tsx`

After this pass, the first-screen `tsc` errors moved off the message stack and into the next shared UI layer. The current leading frontier is now concentrated in:
- `src/components/MessageSelector.tsx`
- `src/components/MessageTimestamp.tsx`
- `src/components/ModelPicker.tsx`
- `src/components/NativeAutoUpdater.tsx`
- `src/components/Onboarding.tsx`
- `src/components/OutputStylePicker.tsx`

This is another useful phase boundary: the repository is no longer blocked by message rendering or attachment/type-recovery issues, and the remaining first-screen errors are now centered in reusable selection/picker/onboarding components.

### Permissions Flow Type Recovery

I then pushed the TypeScript baseline past the first permissions workflow screens and recorded where local type fixes now intentionally differ from `cli.js.map`.

- confirmed current local-vs-map diffs in the active permissions files are from intentional type recovery, not source restoration damage:
  - `src/components/permissions/ComputerUseApproval/ComputerUseApproval.tsx`
  - `src/components/permissions/NotebookEditPermissionRequest/NotebookEditPermissionRequest.tsx`
  - `src/components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx`
  - `src/components/permissions/FilePermissionDialog/FilePermissionDialog.tsx`
  - `src/components/permissions/FileWritePermissionRequest/FileWriteToolDiff.tsx`
- fixed permission request entry components and request-specific helpers:
  - `src/components/permissions/AskUserQuestionPermissionRequest/AskUserQuestionPermissionRequest.tsx`
  - `src/components/permissions/AskUserQuestionPermissionRequest/QuestionView.tsx`
  - `src/components/permissions/BashPermissionRequest/bashToolUseOptions.tsx`
  - `src/components/permissions/ComputerUseApproval/ComputerUseApproval.tsx`
  - `src/components/permissions/EnterPlanModePermissionRequest/EnterPlanModePermissionRequest.tsx`
  - `src/components/permissions/FallbackPermissionRequest.tsx`
  - `src/components/permissions/FileEditPermissionRequest/FileEditPermissionRequest.tsx`
  - `src/components/permissions/FilesystemPermissionRequest/FilesystemPermissionRequest.tsx`
  - `src/components/permissions/FileWritePermissionRequest/FileWritePermissionRequest.tsx`
  - `src/components/permissions/FilePermissionDialog/FilePermissionDialog.tsx`
  - `src/components/permissions/FileWritePermissionRequest/FileWriteToolDiff.tsx`
  - `src/components/permissions/NotebookEditPermissionRequest/NotebookEditPermissionRequest.tsx`
  - `src/components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx`
- added missing type surface needed by reconstructed notebook permission flows:
  - `src/types/notebook.ts`
  - `src/global.d.ts`

After this pass, the leading `tsc --noEmit -p tsconfig.json --pretty false` errors moved off the first request-specific permission dialogs and into the shared permission explanation / decision layer:
- `src/components/permissions/PermissionDecisionDebugInfo.tsx`
- `src/components/permissions/PermissionExplanation.tsx`
- `src/components/permissions/PermissionPrompt.tsx`
- `src/components/permissions/PermissionRequest.tsx`
- `src/components/permissions/PermissionRuleExplanation.tsx`
- `src/components/permissions/rules/*`

This is the next useful boundary: the remaining first-screen errors are now concentrated in the shared permissions framework rather than individual request UIs.

## 2026-04-03 Debug Record: Runtime Restoration Baseline Round 2

### Donor Comparison Follow-up

I continued the `runtime-restoration-baseline` change with direct comparison against the external runnable fork at `D:\Code\test\test2\ClaudeCode\src` and grouped donor candidates into three buckets:

- startup-critical:
  - `src/skills/bundled/verify/*`
  - `src/utils/secureStorage/types.ts`
  - `src/memdir/memoryShapeTelemetry.ts`
  - `src/tasks/LocalWorkflowTask/LocalWorkflowTask.ts`
  - `src/tasks/MonitorMcpTask/MonitorMcpTask.ts`
- validation-critical:
  - `src/constants/querySource.ts`
  - `src/components/ui/option.tsx`
  - `src/types/fileSuggestion.ts`
  - `src/types/messageQueueTypes.ts`
  - `src/types/statusLine.ts`
  - `src/types/utils.ts`
  - `src/components/Spinner/types.ts`
  - `src/services/contextCollapse/persist.ts`
- deferred:
  - monitor / workflow / review-artifact UI surfaces and tools
  - broader telemetry exporter gaps
  - repository-wide permission-framework type cleanup

### Donor-Based Repairs Applied

I imported or recreated the low-conflict donor files that reduce active missing-module pressure without overriding this repository's current provider/runtime work:

- runtime and startup support:
  - `src/skills/bundled/verify/SKILL.md`
  - `src/skills/bundled/verify/examples/cli.md`
  - `src/skills/bundled/verify/examples/server.md`
  - `src/utils/secureStorage/types.ts`
  - `src/memdir/memoryShapeTelemetry.ts`
  - `src/tasks/LocalWorkflowTask/LocalWorkflowTask.ts`
  - `src/tasks/MonitorMcpTask/MonitorMcpTask.ts`
- shared shim / type surfaces:
  - `src/constants/querySource.ts`
  - `src/components/ui/option.tsx`
  - `src/components/Spinner/types.ts`
  - `src/types/fileSuggestion.ts`
  - `src/types/messageQueueTypes.ts`
  - `src/types/statusLine.ts`
  - `src/types/utils.ts`
  - `src/services/contextCollapse/persist.ts`
- deferred feature placeholders, intentionally not on the startup path:
  - monitor / workflow / review-artifact task, tool, permission, and dialog shells

Where the donor placeholders were too narrow for the current tree, I widened them to a local minimum-compatible surface instead of copying them blindly. In practice that was necessary for:

- `SecureStorage` to expose `name`, `read`, `readAsync`, `update`, and `delete`
- `memoryShapeTelemetry` to expose `logMemoryWriteShape`
- `LocalWorkflowTaskState` / `MonitorMcpTaskState` to satisfy `TaskStateBase`
- `components/ui/option.tsx` to export a type surface instead of a null component

### Validation Status After Donor Round 2

Runtime baseline validation still passes after the donor-based repairs:

- `bun src/entrypoints/cli.tsx --version`
- `bun src/entrypoints/cli.tsx --help`
- `node cli.js --version`
- `npm run validate:restoration`

Repository-wide `tsc` remains a monitoring signal only, but the donor follow-up reduced the missing-module frontier materially:

- previous monitoring snapshot:
  - `TS7006`: 828
  - `TS2307`: 288
  - `TS2339`: 270
  - `TS18046`: 156
  - `TS2305`: 115
- after donor round 2:
  - `TS7006`: 760
  - `TS2307`: 208
  - `TS2339`: 352
  - `TS18046`: 126
  - `TS2305`: 123

Interpretation:

- donor follow-up helped on missing modules and some unknown-type propagation
- it did not make repository-wide `tsc` a near-term gate
- the next meaningful work clusters are still shared permission-framework typing, telemetry package/version mismatches, and reconstructed generic helper signatures

This confirms the current strategy: keep the runnable-source baseline green, keep using donor code selectively for missing-module restoration, and continue treating full-repo `tsc` as deferred debt unless a failing path is on the active runtime baseline.

## 2026-04-03 Debug Record: Strategy Clarification And Type-Surface Pass

### Strategy Clarification

I revisited the external reconstruction notes and aligned the OpenSpec change artifacts with the actual restoration strategy now in use.

The key clarification is:

- this repository is being repaired with a runnable-restoration strategy, not a full-source-reconstruction strategy
- the published artifact is known to be missing 100+ feature-gated/internal modules because Bun compile-time elimination removed them before packaging
- repository-wide `tsc` therefore remains a triage tool and debt signal, not the immediate success gate

To make that explicit for future contributors, I updated:

- `openspec/changes/runtime-restoration-baseline/proposal.md`
- `openspec/changes/runtime-restoration-baseline/design.md`

The updated artifacts now state that the team should:

- keep the runnable-source baseline green first
- prefer central compatibility fixes over repeated local workarounds
- classify missing imports before repair
- use donor code selectively as a reference, not as an upstream merge target
- work repository-wide type debt in grouped clusters only when it reduces active-path noise

### Type-Surface Repair Pass

After the strategy update, I continued the current high-leverage declaration/export repair cluster instead of returning to broad file-by-file UI typing work.

This pass widened shared shim surfaces in:

- `src/types/tools.ts`
- `src/types/message.ts`
- `src/types/fileSuggestion.ts`
- `src/types/statusLine.ts`
- `src/utils/context.ts`
- `src/utils/effort.ts`
- `src/utils/model/model.ts`
- `src/types/restoration-shims.d.ts`

The intent of this pass was to reduce cross-cutting "missing export / missing declaration / unresolved package type" noise before re-entering any large UI family such as permissions.

### Monitoring Result After This Pass

`tsc --noEmit -p tsconfig.json --pretty false` still fails, but the declaration/export pass reduced several error classes:

- previous snapshot:
  - `TS2305`: 123
  - `TS2307`: 208
  - `TS2304`: 22
  - `TS7016`: 37
- after this pass:
  - `TS2305`: 108
  - `TS2307`: 207
  - `TS2304`: 21
  - `TS7016`: 24

Interpretation:

- the grouped type-surface repair strategy is working as intended for shared declaration gaps
- the next high-signal cluster remains broad exported-type coverage and runtime-safe shims for still-missing published-artifact modules
- the large permission-framework `TS7006` cluster is still deferred until shared declaration pressure is lower

## 2026-04-06 Debug Record: High-Yield Debt Reduction Recovery Assessment

### Review Summary

Work resumed under `high-yield-debt-reduction` after a pause. The first session goal was not to resume broad implementation immediately, but to re-establish the current baseline and lock the second-phase execution boundary back to the new change.

Recovery validation results from the first resume probe were initially noisy because slow commands were run in parallel. Re-running the same checks sequentially produced the expected baseline:

- `bun src/entrypoints/cli.tsx --version`: passing
- `bun src/entrypoints/cli.tsx --help`: passing
- `node cli.js --version`: passing
- `node scripts/validate-restoration.mjs`: passing
- `node node_modules/typescript/bin/tsc --noEmit --pretty false`: still failing globally, as expected for deferred debt monitoring

Interpretation:

- the runnable baseline is still green
- the brief timeout concern was environmental noise during parallel validation, not a confirmed product regression
- second-phase debt reduction can proceed so long as baseline checks stay sequential and explicit in the execution record

### Cluster Treatment Decisions

The first implementation clusters for `high-yield-debt-reduction` are now fixed as:

- `src/components/permissions/rules/*`
  - treatment: localized rewrite at the subarea level, with some orchestration files allowed to stay as bounded cleanup if a rewrite would expand too far
- `src/utils/telemetry/*`
  - treatment: compatibility-layer replacement, not repo-wide typing cleanup

This keeps the second-phase scope aligned with the design:

- choose bounded clusters
- prefer high-leverage local restructuring
- avoid broad repo-wide `tsc` chasing

### Deferred Module Boundaries

The following noisy areas are explicitly deferred for this change unless they become direct runnable-baseline blockers:

- core runtime and startup systems
  - `src/entrypoints/*`
  - `src/state/*`
  - `src/utils/sessionStorage.ts`
  - `src/utils/task/*`
  - provider/tool execution cores
- low-value shim territory
  - feature-gated or Bun-elided internal modules that are already handled through guards or placeholders
  - optional dependency paths that already have degraded behavior
- broad cross-repo UI families outside the first selected clusters
  - prompt input and onboarding surfaces
  - unrelated permission request dialogs outside `permissions/rules`

### Permissions Rules Cluster Map

The `src/components/permissions/rules/*` cluster is now split into three bounded subareas:

- rule authoring helpers
  - `AddPermissionRules.tsx`
  - `PermissionRuleInput.tsx`
  - `PermissionRuleDescription.tsx`
  - preferred treatment: localized rewrite
- workspace directory flows
  - `AddWorkspaceDirectory.tsx`
  - `RemoveWorkspaceDirectory.tsx`
  - `WorkspaceTab.tsx`
  - preferred treatment: localized rewrite
- rule list / navigation / recent-denial orchestration
  - `PermissionRuleList.tsx`
  - `RecentDenialsTab.tsx`
  - preferred treatment: bounded cleanup first, with localized extraction only if the file remains too unstable

This split is intentional:

- it creates a safe entry point for `2.2`
- it avoids starting with the largest orchestration file
- it preserves permission persistence behavior as a hard constraint

### Next-Step Decision

The next implementation step should be:

- re-triage the source help timeout just enough to confirm whether the runnable baseline has truly regressed or whether the timeout is environmental
- if the help path is still a real blocker, repair it before taking on behavior-changing debt work
- once the baseline is confirmed, start `2.2` in the smallest `permissions/rules` subarea:
  - rule authoring helpers first
  - workspace directory flows second
  - `PermissionRuleList.tsx` last

This means the recovery session completed:

- task `1.1`
- task `1.2`
- task `2.1`

and then moved into the first bounded implementation pass once the baseline was re-confirmed.

## 2026-04-06 Debug Record: Permissions Rules First Pass

### Review Summary

The first implementation pass for `high-yield-debt-reduction` started with the smallest `permissions/rules` subarea:

- `AddPermissionRules.tsx`
- `PermissionRuleDescription.tsx`
- `PermissionRuleInput.tsx`

These files were still in decompiled/react-compiler form and were good candidates for a localized rewrite that preserved existing behavior while improving maintainability and removing local type drift.

### Refactor Decision

This pass treated the rule-authoring helpers as a localized rewrite rather than continuing line-by-line type patching.

Rationale:

- the files were self-contained
- they do not own permission persistence state by themselves
- their behavior is easy to preserve while rewriting into normal TSX
- this is the intended shape of the new change: rewrite small, high-yield leaves before touching large orchestration files

### Changes Applied

I replaced the decompiled versions of:

- `src/components/permissions/rules/AddPermissionRules.tsx`
- `src/components/permissions/rules/PermissionRuleDescription.tsx`
- `src/components/permissions/rules/PermissionRuleInput.tsx`

with cleaned-up TSX implementations that:

- preserve the existing permission-update and unreachable-rule detection flow
- keep the same save-destination options and permission-rule parsing behavior
- remove local implicit-`any` drift and reconstructed control-flow noise
- keep the cluster boundary tight by avoiding changes to shared permission persistence models

### Validation Notes

Executed baseline validation after the rewrite:

- `node scripts/validate-restoration.mjs`

Observed result:

- source version: passing
- source help: passing
- prebuilt version: passing

Executed repository-wide monitoring validation:

- `node node_modules/typescript/bin/tsc --noEmit --pretty false`

Local cluster interpretation after this pass:

- `AddPermissionRules.tsx` no longer appears in the `tsc` output
- `PermissionRuleDescription.tsx` no longer appears in the `tsc` output
- `PermissionRuleInput.tsx` no longer appears in the `tsc` output
- the active `permissions/rules` frontier has moved to:
  - `AddWorkspaceDirectory.tsx`
  - `PermissionRuleList.tsx`
  - `RecentDenialsTab.tsx`
  - `RemoveWorkspaceDirectory.tsx`
  - `WorkspaceTab.tsx`

This is the expected localized win:

- the first leaf subarea has been normalized
- the runnable baseline remained green
- the remaining cluster pressure is now concentrated in workspace and orchestration files

### Next Follow-up

The next recommended implementation step is:

- continue `permissions/rules` with the workspace directory subarea:
  - `AddWorkspaceDirectory.tsx`
  - `RemoveWorkspaceDirectory.tsx`
  - `WorkspaceTab.tsx`

and only then return to the larger orchestration file:

- `PermissionRuleList.tsx`

This keeps the high-yield debt-reduction strategy intact and avoids starting the second pass with the most entangled file in the cluster.

## 2026-04-06 Debug Record: Permissions Rules Workspace Pass

### Review Summary

I continued the `permissions/rules` cluster with the second bounded subarea:

- `AddWorkspaceDirectory.tsx`
- `RemoveWorkspaceDirectory.tsx`
- `WorkspaceTab.tsx`

As with the first helper pass, these files were still in decompiled/react-compiler form and were better treated as localized rewrites than as incremental type patch targets.

### Refactor Decision

This pass kept the same constraints as the first one:

- preserve permission behavior
- preserve runnable baseline
- avoid expanding into shared permission persistence model changes

The chosen treatment was again localized rewrite, because these files are leaf-oriented UI flow handlers with straightforward behavior.

### Changes Applied

I replaced the decompiled versions of:

- `src/components/permissions/rules/AddWorkspaceDirectory.tsx`
- `src/components/permissions/rules/RemoveWorkspaceDirectory.tsx`
- `src/components/permissions/rules/WorkspaceTab.tsx`

with normal TSX implementations that:

- preserve directory validation, suggestion, and confirmation behavior
- keep the existing add/remove workspace-directory flow
- keep current interaction with permission updates and original working-directory display
- remove local implicit-`any` drift, reconstructed cache scaffolding, and overcomplicated control flow

### Validation Notes

Executed baseline validation after the workspace pass:

- `node scripts/validate-restoration.mjs`

Observed result:

- source version: passing
- source help: passing
- prebuilt version: passing

Executed repository-wide monitoring validation:

- `node node_modules/typescript/bin/tsc --noEmit --pretty false`

Local cluster interpretation after this pass:

- `AddWorkspaceDirectory.tsx` no longer appears in the `tsc` output
- `RemoveWorkspaceDirectory.tsx` no longer appears in the `tsc` output
- `WorkspaceTab.tsx` no longer appears in the `tsc` output
- the remaining active `permissions/rules` frontier is now concentrated in:
  - `PermissionRuleList.tsx`
  - `RecentDenialsTab.tsx`

This is the expected next boundary:

- the rule-authoring and workspace leaf flows are now normalized
- the only remaining debt in the cluster is the larger orchestration/list-management layer

### Next Follow-up

The next implementation step should target:

- `RecentDenialsTab.tsx`
- `PermissionRuleList.tsx`

in that order if possible, or as a paired pass if `PermissionRuleList.tsx` depends too directly on the denials tab typing surface.

## 2026-04-06 Debug Record: Permissions Rules Orchestration Pass

### Review Summary

I completed the remaining `permissions/rules` orchestration frontier by replacing:

- `RecentDenialsTab.tsx`
- `PermissionRuleList.tsx`

with normal TSX implementations.

This pass intentionally stopped at the cluster boundary and did not expand into
telemetry or shared runtime systems.

### Refactor Decision

The treatment remained localized rewrite rather than patch-in-place because:

- both files were still dominated by decompiled react-compiler cache scaffolding
- the remaining errors were concentrated in inferred state and prop surfaces
- behavior could be preserved more safely by reconstructing the component logic
  directly than by continuing to patch `never` / implicit-`any` fallout

### Changes Applied

The rewritten versions preserve the current interaction model for:

- recent denial approval and retry selection
- rule search / list / selection flow
- rule deletion flow
- add-rule and workspace add/remove transitions
- permission change summary generation on exit
- header-focus coordination with the shared tab system

The pass also normalized file encoding for `PermissionRuleList.tsx`, which had
been in a non-UTF8 state that blocked `apply_patch`.

### Validation Notes

Executed baseline validation after the orchestration pass:

- `node scripts/validate-restoration.mjs`

Observed result:

- source version: passing
- source help: passing
- prebuilt version: passing

Executed repository-wide monitoring validation:

- `node node_modules/typescript/bin/tsc --noEmit --pretty false`

Local cluster interpretation after this pass:

- `RecentDenialsTab.tsx` no longer appears in the `tsc` output
- `PermissionRuleList.tsx` no longer appears in the `tsc` output
- no files from the targeted `permissions/rules` cluster remain in the current
  `tsc` monitoring output

This is the intended cluster outcome:

- the first high-yield debt-reduction cluster is now out of the active error
  frontier
- the runnable baseline remains green
- unrelated repository-wide debt remains deferred per the change strategy

### Next Follow-up

The next recommended implementation step is to move to the second planned
cluster:

- define the supported telemetry compatibility surface
- implement the bounded telemetry compatibility-layer replacement
- validate local telemetry debt reduction while preserving the runnable baseline
## High-Yield Debt Reduction: Donor Infrastructure Pivot

Date: 2026-04-07

The external restoration sample changed the remaining strategy for this change. The sample's "8 source files" result is not just a smaller patch set; it depends on infrastructure outside `src`:

- a restoration dependency surface and lockfile
- local `shims/*` packages for private/native modules
- `vendor/*` TypeScript replacements for native bindings
- a `src/dev-entry.ts` launcher that injects `MACRO` and reports missing restored imports
- a restoration TypeScript posture that avoids using repo-wide strict `tsc` as the first gate

Decision: stop treating telemetry as a source rewrite first. For this phase, the remaining treatment is donor restoration infrastructure alignment.

Implemented in this pass:

- Updated `high-yield-debt-reduction` proposal, design, specs, and tasks to reflect the donor-infrastructure pivot.
- Added `shims/*` from `D:\Code\test\test2\ClaudeCode\shims`.
- Confirmed existing `vendor/*-src` files already match the donor sample by SHA-256 and did not overwrite them.
- Added `src/dev-entry.ts` as a restored development launcher and wired `package.json` `dev`, `start`, and `version:restored` scripts to it.
- Merged the donor dependency surface into `package.json` without replacing current package identity, version, bin, or validation script.
- Moved the direct publishing guard from `prepare` to `prepublishOnly` so local `bun install` works while publish protection remains.
- Added OpenTelemetry OTLP/prometheus exporter packages because the current source imports them dynamically and they are dependency-boundary issues, not source rewrite issues.
- Reverted telemetry imports back to normal package entrypoints after restoring complete OpenTelemetry packages.
- Kept the earlier ripgrep fallback: missing bundled `src/utils/vendor/ripgrep/.../rg.exe` falls back to system `rg`.
- Migrated the donor `main.tsx` Commander compatibility patch: `-d2e` is rewritten to `--debug-to-stderr`, and Commander only registers the legal long flag.

Validation:

- `bun install` passes after changing `prepare` to `prepublishOnly`.
- `bun -e "import('@opentelemetry/sdk-metrics')"` passes and confirms a complete OpenTelemetry package is installed.
- `bun -e "import('@ant/computer-use-mcp')"` passes and confirms local shim packages resolve.
- `bun -e` import checks for OTLP HTTP metric/log/trace exporters pass.
- `npm run validate:restoration` passes.
- `bun run dev -- --version` passes through the restored dev launcher and reports `missing_relative_imports=86`.
- `bun src/entrypoints/cli.tsx --bare -p "Say OK only." --debug --debug-file .tmp-run-donor-infra.log` still times out after 120s, but the previous `@opentelemetry/sdk-metrics` missing-package error and private/native shim import errors no longer appear. The log reaches provider validation and startup command loading, then ends after ripgrep fallback.

TypeScript monitoring:

- `TS2307` decreased to `153` after dependency restoration.
- Remaining telemetry TypeScript errors are now mostly export/type-surface mismatch (`TS2305`) rather than missing package runtime blockers.
- Remaining `@ant/computer-use-mcp` errors are shim type-surface mismatch and should be treated as a narrow shim follow-up if needed.

Follow-up decision:

- Do not resume broad telemetry source rewrites in this change. If `-p` remains blocked, investigate the next runtime stall from the debug log and process lifecycle.
- Telemetry source-level cleanup is not justified until dependency and shim alignment are fully accounted for.
- The repo has tracked `node_modules` files. Running `bun install` touched many of them; those install artifacts should not be considered source changes for this OpenSpec work.
- Follow-up repository hygiene decision: remove tracked `node_modules` files from the Git index and rely on `package.json` + `bun.lock` + local `shims/*` to reproduce dependencies. This preserves the local `node_modules` directory but prevents future `bun install` runs from polluting `git status`.

## 2026-04-07 Debug Record: Runtime Activation Follow-up Boundary

### Review Summary

After donor infrastructure alignment, the repository now has three distinct states that must not be conflated:

- completed restoration baseline
- donor-aligned development scanner behavior
- not-yet-activated direct source runtime

Validation in the current workspace confirms:

- `bun src/entrypoints/cli.tsx --version` passes
- `bun src/entrypoints/cli.tsx --help` passes
- `npm run validate:restoration` passes
- `bun run dev` does not represent real runtime activation; it is scanner-mode behavior while unresolved relative imports remain
- `bun src/entrypoints/cli.tsx --bare -p "Say OK only."` still requires a narrower blocker investigation because startup progresses but the flow does not complete inside the current bounded window

### Debug Record: Scanner Versus Runtime Activation

#### Symptom

The repository can appear both "working" and "not running" depending on which command a maintainer chooses:

- baseline validation commands succeed
- `bun run dev` stops early and reports unresolved relative imports

#### Root Cause

`src/dev-entry.ts` is currently a restoration launcher and scanner, not the canonical runtime entrypoint. It injects source-runtime macro compatibility, inventories unresolved relative imports, and exits early until forwarding criteria are satisfied.

#### Decision

Stop treating `bun run dev` failure as proof that the direct source runtime has regressed.

Treat follow-up work in two parts:

- direct runtime activation on `src/entrypoints/cli.tsx`
- unresolved-import triage from `src/dev-entry.ts`

#### Verification

Executed:

- `bun run ./src/dev-entry.ts --version`
- `bun run ./src/dev-entry.ts`
- `bun src/entrypoints/cli.tsx --version`
- `bun src/entrypoints/cli.tsx --help`
- `npm run validate:restoration`

Observed result:

- the launcher reports `missing_relative_imports=86`
- the direct source baseline remains green

### Follow-up Decision

Create a dedicated follow-up change, `restored-runtime-activation`, for:

- minimal direct source runtime activation
- `--bare -p` stall isolation
- unresolved relative-import inventory and classification

Do not pull this follow-up back into `runtime-restoration-baseline` or continue treating it as implied remaining work inside `high-yield-debt-reduction`.

## 2026-04-07 Debug Record: Restored Runtime Activation Round 1

### Review Summary

The first execution pass for `restored-runtime-activation` focused on analysis and task closure rather than speculative source restoration. The goal of this pass was to convert two ambiguous problem statements into explicit execution contracts:

- what the direct runtime activation gate actually is
- what the 86 unresolved relative imports should be treated as

Current state after this pass:

- the direct activation gate is explicitly distinct from the restoration baseline and from repository-wide `tsc`
- `bun run dev` is explicitly treated as scanner-mode behavior, not as proof of direct runtime failure
- the unresolved relative-import inventory is captured and grouped
- treatment rules and follow-up buckets are recorded in `openspec/changes/restored-runtime-activation/inventory.md`

### Debug Record: Direct Runtime Gate Reconfirmed

#### Symptom

The repository had no stable working distinction between:

- startup baseline validation
- development-launcher diagnostics
- true direct source runtime activation

This made `bun run dev` appear to be a runtime regression even though it is currently scanner-gated by design.

#### Root Cause

The donor-infrastructure pass introduced `src/dev-entry.ts` as a scanner and launcher, but the follow-up contract for runtime activation versus scanner behavior had not yet been written down as an executable rule set.

#### Decision

Use the following as the direct runtime activation gate for the current phase:

- `bun src/entrypoints/cli.tsx --version`
- `bun src/entrypoints/cli.tsx --help`
- `npm run validate:restoration`
- `bun src/entrypoints/cli.tsx --bare -p "Say OK only."`

Treat `bun run dev` as scanner-mode behavior until explicit forwarding criteria are met.

#### Verification

Executed:

- `bun src/entrypoints/cli.tsx --version`
- `bun src/entrypoints/cli.tsx --help`
- `npm run validate:restoration`
- `bun run ./src/dev-entry.ts --version`
- `bun run ./src/dev-entry.ts`

Observed result:

- baseline commands remain green
- `bun run dev` still reports `missing_relative_imports=86` and exits in scanner mode

### Debug Record: Direct Print Path Narrowing

#### Symptom

`bun src/entrypoints/cli.tsx --bare -p "Say OK only." --debug --debug-file ...` still does not complete in the current bounded window.

#### Root Cause

The initial suspicion was that telemetry initialization itself might be blocking, because the last emitted debug line came from telemetry setup.

Further code-path review invalidated that assumption for print mode:

- `initializeTelemetryAfterTrust()` is invoked without `await` on the print-mode path
- the log position therefore does not identify telemetry as the blocking awaited stage

#### Decision

Treat the active blocker as post-startup headless runtime activation rather than telemetry startup specifically.

The next narrow blocker zone is the awaited print-mode chain after startup completes, especially:

- org validation
- headless initialization
- awaited MCP connection batch
- first request-path setup

#### Verification

Executed:

- `bun src/entrypoints/cli.tsx --bare -p "Say OK only." --debug --debug-file .tmp-runtime-activation.log`

Observed result:

- the command still stalls without a printed response
- the debug log reaches startup completion and telemetry kickoff
- code-path review shows telemetry kickoff is fire-and-forget in print mode, so the stall must be downstream of that point

### Debug Record: Missing Import Inventory And Triage

#### Symptom

The launcher reported an unresolved-import count, but there was no authoritative grouped inventory and no agreed repair strategy per item class.

#### Root Cause

Missing-import work was still at risk of collapsing into raw count reduction or file-by-file cleanup.

#### Decision

Capture the inventory and classify each family into one of four treatment types:

- `restore`
- `shim`
- `guard`
- `defer`

Use grouped follow-up buckets rather than import-list order.

#### Verification

Executed:

- refresh of the full `src/dev-entry.ts` unresolved-import scan
- grouping of the scan by importer root and rough treatment signal

Observed result:

- total unresolved relative imports: `86`
- rough composition:
  - asset/native gaps: `31`
  - likely internal/dead-code-eliminated surfaces: `30`
  - ordinary source gaps: `16`
  - shared type gaps: `9`

Recorded output:

- `openspec/changes/restored-runtime-activation/inventory.md`

### Follow-up Decision

The next implementation pass should not start by reducing the raw unresolved-import count.

Instead it should start with one of these bounded buckets:

- low-risk shared support-file restoration
- internal-feature guard layer for clearly unsupported surfaces
- compatibility shims for shared type/native boundaries

That work can now proceed without reopening the earlier mistake of broad repository-wide `tsc` cleanup.

## 2026-04-07 Debug Record: Restored Runtime Activation Round 2

### Review Summary

The second pass moved from analysis into bounded restoration. The goal was to exhaust the cheapest real `restore` work before switching the change into `guard` and `shim` mode.

Observed result:

- `bun run ./src/dev-entry.ts --version` moved from `missing_relative_imports=86` to `missing_relative_imports=38`
- the restored files were low-risk support files, placeholders, and documentation assets rather than speculative internal subsystem implementations
- the remaining unresolved imports now skew strongly toward internal/optional features and compatibility boundaries

### Debug Record: Restore Bucket Execution

#### Decision

Implement the lowest-risk donor-backed restore groups first:

- shared support files used by multiple importers
- lightweight bundled skill placeholders
- bundled `claude-api` text assets as placeholders
- lightweight source placeholders for `query/transitions` and `utils/taskSummary`

#### Fix

This pass added:

- `src/services/lsp/types.ts`
- `src/services/tips/types.ts`
- `src/utils/filePersistence/types.ts`
- `src/services/remoteManagedSettings/securityCheck.jsx`
- `src/utils/permissions/yolo-classifier-prompts/*`
- `src/ink/cursor.ts`
- `src/ink/events/paste-event.ts`
- `src/ink/events/resize-event.ts`
- `src/utils/ultraplan/prompt.txt`
- `src/skills/bundled/dream.ts`
- `src/skills/bundled/hunter.ts`
- `src/skills/bundled/runSkillGenerator.ts`
- `src/skills/bundled/claude-api/**` placeholder docs
- `src/query/transitions.ts`
- `src/utils/taskSummary.ts`

#### Verification

Executed:

- repeated `bun run ./src/dev-entry.ts --version` after each restore group
- targeted file diagnostics for the newly added restore files

Observed result:

- after the first support-file bucket: `missing_relative_imports=70`
- after the second lightweight placeholder bucket: `missing_relative_imports=66`
- after the bundled `claude-api` placeholders: `missing_relative_imports=40`
- after the final lightweight source placeholders: `missing_relative_imports=38`
- no direct file errors were reported for the newly added restore files

### Follow-up Decision

The restore-oriented phase has now delivered most of its cheap value.

The next efficient pass should focus on:

- `guard` for internal or unsupported surfaces such as UDS, worker agents, skill-search internals, SSH extras, and Anthropic-only REPL adjuncts
- `shim` for compatibility boundaries such as `mcpSkills.js` and `image-processor.node`
- optional scanner cleanup for comment-driven false positives in `commands/clear/index.ts`

Continuing to treat the remaining 38 entries as pure restore work would no longer be the high-yield path.

## 2026-04-07 Debug Record: Restored Runtime Activation Round 3

### Review Summary

The third pass executed the first bounded internal-surface `guard` and compatibility `shim` bucket rather than continuing generic restoration.

Observed result:

- `bun run ./src/dev-entry.ts --version` moved from `missing_relative_imports=38` to `missing_relative_imports=22`
- the newly added files are all degraded no-op or empty-return implementations for explicitly optional or internal surfaces
- the remaining unresolved imports now cluster around Anthropic-only UI adjuncts, SSH extras, internal prompt helpers, and the known `commands/clear/index.ts` false positives

### Debug Record: Internal Guard Bucket Execution

#### Decision

Implement the smallest remaining donor-style guard bucket whose exports were clearly defined by current callsites:

- experimental skill-search helpers
- coordinator worker-agent surfaces
- assistant session discovery
- UDS and bridge peer messaging helpers
- protected namespace check

Add the minimal MCP skill shim needed to preserve existing `.cache.delete(...)` callsites without trying to recreate MCP skill discovery behavior.

#### Fix

This pass added:

- `src/services/skillSearch/featureCheck.ts`
- `src/services/skillSearch/prefetch.ts`
- `src/services/skillSearch/remoteSkillState.ts`
- `src/services/skillSearch/remoteSkillLoader.ts`
- `src/services/skillSearch/signals.ts`
- `src/services/skillSearch/telemetry.ts`
- `src/coordinator/workerAgent.ts`
- `src/assistant/sessionDiscovery.ts`
- `src/utils/udsMessaging.ts`
- `src/utils/udsClient.ts`
- `src/bridge/peerSessions.ts`
- `src/skills/mcpSkills.ts`
- `src/utils/protectedNamespace.ts`

Implementation posture:

- feature probes return disabled or empty values
- remote or peer messaging paths degrade with explicit failure results instead of missing-module crashes
- assistant discovery and coordinator agents return empty collections
- `fetchMcpSkillsForClient` preserves memoized cache shape through a `.cache` `Map`

#### Verification

Executed:

- file diagnostics on all newly added guard/shim files
- `bun run ./src/dev-entry.ts --version`
- `bun run ./src/dev-entry.ts`

Observed result:

- no direct file diagnostics were reported for the new files
- scanner count reduced to `22`
- top remaining unresolved imports are now:
  - `commands/agents-platform/index.js`
  - `services/compact/cachedMCConfig.js`
  - `tools/DiscoverSkillsTool/prompt.js`
  - `bridge/webhookSanitizer.js`
  - `ssh/*`
  - `jobs/classifier.js`
  - several Anthropic-only REPL callouts and internal tool panels
  - `tools/SnipTool/prompt.js`
  - internal-only classifier helper tool surfaces

### Follow-up Decision

The next useful work is now narrower than the prior guard bucket.

Highest-yield options are:

- scanner cleanup for the two `commands/clear/index.ts` comment-driven false positives
- a final small guard bucket for `jobs/classifier.js`, `cachedMCConfig.js`, `DiscoverSkillsTool/prompt.js`, and `bridge/webhookSanitizer.js`
- defer or continue guarding Anthropic-only REPL callouts, SSH helpers, and internal tool panels only if the launcher still benefits materially

## 2026-04-07 Debug Record: Restored Runtime Activation Round 4

### Review Summary

The fourth pass finished the scanner-side restoration work.

Observed result:

- the launcher moved from `missing_relative_imports=22` to forwarding behavior
- `bun run ./src/dev-entry.ts --version` now prints `2.1.88`
- `bun run ./src/dev-entry.ts --help` now prints the real CLI help output

### Debug Record: Scanner Overcount Removal

#### Symptom

After the previous guard buckets, the remaining scanner blockers were dominated by non-runtime surfaces:

- `import type` and `export type` references
- comment-text false positives in `commands/clear/index.ts`
- optional native `.node` bindings already wrapped in `try/catch`

These kept `src/dev-entry.ts` in scanner mode even though they were no longer meaningful launcher blockers.

#### Decision

Align `src/dev-entry.ts` with the active runtime contract instead of raw static import counting.

Specifically:

- ignore type-only imports/exports
- strip comments before import scanning
- ignore optional `.node` bindings that are already runtime-guarded

#### Fix

This pass updated `src/dev-entry.ts` to exclude the over-counted cases above.

This pass also added the last thin stubs required for feature-gated surfaces that were still keeping the scanner from forwarding:

- `src/assistant/gate.ts`
- `src/proactive/useProactive.ts`
- `src/tools/PushNotificationTool/PushNotificationTool.ts`
- `src/tools/REPLTool/REPLTool.ts`
- `src/tools/SendUserFileTool/SendUserFileTool.ts`
- `src/tools/SleepTool/SleepTool.ts`
- `src/tools/SubscribePRTool/SubscribePRTool.ts`
- `src/tools/SuggestBackgroundPRTool/SuggestBackgroundPRTool.ts`
- `src/tools/VerifyPlanExecutionTool/VerifyPlanExecutionTool.ts`

#### Verification

Executed:

- `bun run ./src/dev-entry.ts --version`
- `bun run ./src/dev-entry.ts --help`

Observed result:

- `--version` forwarded to the real entrypoint and returned `2.1.88`
- `--help` forwarded to the real entrypoint and printed the actual CLI help
- direct launcher forwarding is now restored for the validated argument paths

### Follow-up Decision

Further work should now focus on direct runtime behavior rather than additional scanner cleanup.

If the user wants to continue this line, the next highest-yield step is to retest and narrow the real forwarded runtime path, especially the existing `--bare -p` headless stall, now that scanner-mode launcher blocking has been removed.

### Validation Addendum

Executed after forwarding recovery:

- `npm run validate:restoration`
- `bun run ./src/dev-entry.ts --bare -p "Say OK only." --debug --debug-file .tmp-runtime-activation-dev-entry.log`

Observed result:

- restoration validation remains green
- the forwarded headless prompt path still did not complete within the 120s bounded window
- the new debug tail still ends in the same narrowed startup region around startup completion and telemetry initialization, not in scanner-mode restoration code

Interpretation:

- scanner-side launch blocking is now resolved
- the remaining active issue is again the real forwarded headless runtime stall

## 2026-04-07 Debug Record: Restored Runtime Activation Round 5

### Review Summary

The fifth pass resolved the forwarded headless runtime stall enough to reach the real auth boundary.

Observed result:

- `bun -e "await import('./src/cli/structuredIO.ts')"` initially failed with a concrete module-initialization error rather than hanging
- `bun -e "await import('./src/cli/print.ts')"` then exposed one remaining missing-export defect in a previously restored placeholder file
- after both fixes, `bun run ./src/dev-entry.ts --bare -p "Say OK only."` now reaches `runHeadless()`, initializes the request path, and exits with the expected auth error for an unauthenticated local environment: `Not logged in · Please run /login`

### Debug Record: envDynamic Circular-Initialization Fix

#### Symptom

After narrowing the forwarded stall to `await import('src/cli/print.js')`, directly importing `src/cli/structuredIO.ts` revealed:

- `ReferenceError: Cannot access 'env' before initialization`
- thrown from `src/utils/envDynamic.ts`

#### Root Cause

`src/utils/envDynamic.ts` eagerly constructed `envDynamic` with `...env` at module load time.

That forced an immediate read of `env` during a circular import path, producing a temporal-dead-zone failure before the print runtime could finish evaluating.

#### Decision

Preserve the `envDynamic` surface, but make environment-property reads lazy so module evaluation does not touch `env` before `src/utils/env.ts` completes initialization.

#### Fix

Updated `src/utils/envDynamic.ts` to export `envDynamic` via a `Proxy` that:

- serves the dynamic helper methods from the proxy target
- computes `terminal` lazily through `getTerminalWithJetBrainsDetection()`
- falls back to `env` property reads only when the property is actually accessed

#### Verification

Executed:

- `bun -e "await import('./src/cli/structuredIO.ts'); console.log('structuredIO ok')"`

Observed result:

- the import now completes successfully

### Debug Record: File Persistence Type Surface Completion

#### Symptom

After the `envDynamic` fix, directly importing `src/cli/print.ts` exposed a second real runtime defect:

- `SyntaxError: Export named 'DEFAULT_UPLOAD_CONCURRENCY' not found in module 'src/utils/filePersistence/types.ts'`

#### Root Cause

The earlier restoration pass added `src/utils/filePersistence/types.ts` as an overly thin placeholder that only exported `TurnStartTime`, while the active runtime path required:

- `DEFAULT_UPLOAD_CONCURRENCY`
- `FILE_COUNT_LIMIT`
- `OUTPUTS_SUBDIR`
- `PersistedFile`
- `FailedPersistence`
- `FilesPersistedEventData`

#### Decision

Replace the placeholder with the smallest complete type/constants surface required by current `filePersistence.ts` consumers instead of further guarding the callsite.

#### Fix

Expanded `src/utils/filePersistence/types.ts` to export the missing constants and event/result types used by `src/utils/filePersistence/filePersistence.ts`.

#### Verification

Executed:

- `bun -e "await import('./src/cli/print.ts'); console.log('print ok')"`

Observed result:

- the import now completes successfully

### Validation Notes

Executed:

- `bun -e "await import('./src/services/settingsSync/index.ts'); console.log('settingsSync ok')"`
- `bun -e "await import('./src/services/remoteManagedSettings/index.ts'); console.log('remoteManagedSettings ok')"`
- `bun -e "await import('./src/cli/remoteIO.ts'); console.log('remoteIO ok')"`
- `bun -e "await import('./src/cli/structuredIO.ts'); console.log('structuredIO ok')"`
- `bun -e "await import('./src/cli/print.ts'); console.log('print ok')"`
- `bun run ./src/dev-entry.ts --version`
- `bun run ./src/dev-entry.ts --bare -p "Say OK only." --debug --debug-file .tmp-runtime-import-probe-3.log`

Observed result:

- isolated import validation now succeeds for the previously blocked print-runtime chain
- launcher forwarding still returns `2.1.88` for `--version`
- the forwarded headless prompt path now reaches the real API request path and fails only because no local auth method is configured

### Remaining Follow-up

- Treat the current `Not logged in · Please run /login` result as the expected environment-level boundary for unauthenticated validation, not as a restored-source runtime defect.
- If deeper end-to-end prompt validation is desired, the next step is to test with a real login or explicit API key rather than continuing import-restoration work.

## 2026-04-07 Debug Record: Mirror Gap Reduction Round 1

### Review Summary

The first execution pass for `mirror-gap-reduction` closed the phase boundary between runtime activation and post-activation gap cleanup.

Observed result:

- the normal non-bare launcher path remains healthy
- bare-mode auth failure remains expected behavior rather than a restore regression
- the currently known active non-bare placeholder surface is small and no new too-thin runtime placeholder was discovered beyond the phase-1 `filePersistence/types.ts` fix already completed under `restored-runtime-activation`

### Debug Record: Phase Boundary Confirmation

#### Decision

Use the following as the phase-2 regression boundary:

- `bun run ./src/dev-entry.ts --version`
- `bun run ./src/dev-entry.ts -p "Say OK only."`
- `node scripts/validate-restoration.mjs`

Do not use raw missing-import totals or bare-mode OAuth behavior as the main success signal for this phase.

#### Verification

Executed:

- `bun run ./src/dev-entry.ts --version`
- `bun run ./src/dev-entry.ts -p "Say OK only."`
- `node scripts/validate-restoration.mjs`

Observed result:

- version path returned `2.1.88`
- non-bare prompt path returned `OK`
- restoration validation remained green for source version/help and prebuilt version

### Debug Record: Active Non-Bare Placeholder Refresh

#### Symptom

Phase-2 needed an updated answer to a narrower question than the phase-1 inventory: which remaining placeholders or guards are still exercised by active non-bare runtime or validation paths?

#### Decision

Refresh the inventory by checking current importer relationships and current launcher behavior rather than by re-running raw scanner accounting.

#### Verification

Observed current active non-bare placeholder or guard imports:

- `src/services/remoteManagedSettings/index.ts` -> `./securityCheck.jsx`
- `src/setup.ts`, `src/cli/print.ts`, `src/utils/messages/systemInit.ts` -> `../utils/udsMessaging.js`
- `src/main.tsx`, `src/dialogLaunchers.tsx` -> `./assistant/sessionDiscovery.js`
- `src/constants/prompts.ts`, `src/utils/attachments.ts`, `src/tools/SkillTool/SkillTool.ts` -> `../services/skillSearch/featureCheck.js`

Observed mostly type-only or non-runtime-facing placeholder consumers:

- `src/types/plugin.ts`, `src/utils/plugins/lspPluginIntegration.ts` -> `../services/lsp/types.js`

Interpretation:

- `securityCheck.jsx` and `udsMessaging.js` remain on live non-bare startup paths but currently provide sufficient degraded behavior for the validated launcher flows
- `sessionDiscovery.js` remains part of an assistant-attach branch, but no current regression indicates the existing degraded empty-session behavior is too thin for the supported phase-2 boundary
- `featureCheck.js` remains in optional discovery/prompt surfaces, not in the minimal non-bare success path
- no new active-path placeholder was found that requires immediate hardening beyond the already-completed `filePersistence/types.ts` expansion

### Follow-up Decision

- Phase-2 can mark the initial boundary and active-path refresh work complete without adding new runtime hardening code in this pass.
- The next efficient work should focus on guard/defer consolidation and on deciding whether any assistant/UDS/security placeholders deserve stronger contracts for later supported flows.

## 2026-04-07 Debug Record: Mirror Gap Reduction Round 2

### Review Summary

The second execution pass completed the phase-2 consolidation work.

Observed result:

- the remaining `guard` bucket is now explicitly treated as intentionally unsupported internal, optional, or branch-specific mirror behavior
- the remaining `defer` bucket is explicitly limited to documentation-heavy or non-essential auxiliary assets
- the normal launcher validation boundary remains green at the end of the phase

### Debug Record: Guard Bucket Consolidation

#### Decision

Keep the current `guard` bucket limited to surfaces that are still poor candidates for speculative restoration in the current mirror:

- internal session and peer-messaging helpers
- assistant discovery and agent-worker orchestration helpers
- remote skill-search helpers
- Anthropic-only REPL and UI adjuncts
- SSH / REPL side branches and internal-only tool panels

#### Interpretation

Current examples that remain intentionally guarded rather than restored:

- `udsMessaging.js`, `udsClient.js`, `peerSessions.js`
- `assistant/sessionDiscovery.js`, `coordinator/workerAgent.js`
- `services/skillSearch/*`
- `hooks/useSSHSession.ts` dependencies and REPL-only adjunct panels

These surfaces may still be imported by optional branches, but no current normal non-bare runtime validation indicates they are blocking the supported launcher path.

### Debug Record: Defer Bucket Consolidation

#### Decision

Keep the current `defer` bucket limited to:

- bundled documentation placeholders
- non-essential prompt assets
- secondary helper files that are outside the supported normal launcher boundary

#### Interpretation

Current deferred families remain appropriate for later work rather than immediate restoration:

- `skills/bundled/claude-api/**`
- secondary bundled skill registration placeholders
- `utils/ultraplan/prompt.txt`
- `query/transitions.js`, `utils/taskSummary.js`
- `tools/SnipTool/prompt.js`

No current phase-2 evidence suggests these deferred assets should be promoted back into the active runtime bucket.

### Final Validation Notes

Final phase-2 validation boundary executed in this workspace:

- `bun run ./src/dev-entry.ts --version`
- `bun run ./src/dev-entry.ts -p "Say OK only."`
- `node scripts/validate-restoration.mjs`

Observed result:

- version path returned `2.1.88`
- normal non-bare prompt path returned `OK`
- restoration validation remained green

### Final Phase Result

This phase reduced ambiguity rather than adding broad new restoration code.

Work actually reduced in this phase:

- phase boundary confusion between runtime activation and post-activation cleanup
- ambiguity about whether bare-mode OAuth absence is a runtime defect
- ambiguity about which remaining placeholders are still exercised by active non-bare flows
- ambiguity about which unresolved families should stay in `guard` or `defer`

Work intentionally preserved for later phases:

- internal and optional guarded surfaces such as assistant discovery, UDS/peer messaging, remote skill search, SSH adjuncts, and Anthropic-only REPL branches
- documentation-heavy and non-essential deferred assets such as bundled Claude API docs and auxiliary prompts

### Archive Decision

Decision for this phase: leave `mirror-gap-reduction` open only until the task record and inventory updates are complete, then treat it as archive-ready.

Rationale:

- all phase-2 tasks are complete after this pass
- no active implementation blocker remains inside the phase scope
- any future work should be opened as a narrower follow-up change rather than extending this consolidation phase indefinitely
