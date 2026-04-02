# Implementation Notes

## Scope

This file records implementation progress, debug findings, fix decisions, and validation notes for the `provider-abstraction` change.

This file is also the single execution record for the current phase.
Do not create or maintain separate `implementation.md` files under individual change folders unless the execution-record approach is explicitly changed later.

It is not the source of truth for final requirements or architecture:
- Use `specs/model-provider-abstraction/spec.md` for requirements.
- Use `design.md` for final design decisions.
- Use `tasks.md` for implementation status.

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
- when validation is blocked by tooling, record the blocker explicitly
- keep execution notes in this file only; avoid parallel per-change implementation logs

Current file status:
- the content is already usable
- the main change needed is to keep newer entries clearly grouped by review pass so task status, bug findings, and remediation do not blur together

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
