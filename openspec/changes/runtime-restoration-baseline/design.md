## Context

This repository is an internal mirror reconstructed from a bundled Claude Code release and `cli.js.map`, not a complete upstream source tree. Current verification shows a split state:

- the published runtime artifact works (`node cli.js --version` and `bun cli.js --version`)
- the reconstructed source entry does not yet work (`bun src/entrypoints/cli.tsx --version` fails because build-time macros are not restored)
- repository-wide `tsc` still reports a large mixed error surface across missing modules, missing declarations, Bun build-time gaps, and normal type drift

The restoration effort therefore needs a technical baseline that prioritizes runnable source entrypoints and controlled feature degradation over full parity with internal upstream source or immediate full-repository type closure.

Two external reference points reinforce this:

- the reconstructed-source documentation states that 100+ feature-gated modules are absent from the published artifact because Bun compile-time elimination removed them before release packaging
- an external runnable fork demonstrates that source restoration becomes tractable when the effort is framed around startup compatibility, guardrails, and selective shims instead of trying to recreate every missing internal module

## Goals / Non-Goals

**Goals:**
- Define a minimal runnable-from-source baseline for the mirrored repository.
- Restore the required build-time/runtime compatibility layer for macros, Bun feature gating, and missing published modules.
- Separate runtime blockers from non-blocking repository-wide type debt.
- Standardize how missing files are handled so the team stops doing unbounded file-by-file repairs without a restoration model.
- Allow later provider, UI, and enterprise changes to build on a stable source baseline.

**Non-Goals:**
- Achieve full parity with Anthropic internal feature-gated modules that do not exist in the published artifact.
- Require repository-wide `tsc --noEmit -p tsconfig.json` to pass before restoration work can be considered successful.
- Re-implement every feature-gated tool or internal workflow found in decompiled source references.
- Treat external runnable forks as authoritative product behavior; they are implementation references, not upstream truth.

## Operating Strategy

The operating strategy for this change is:

1. Keep the runnable-source baseline green.
2. Fix cross-cutting startup and compatibility blockers centrally where possible.
3. Classify missing modules before repair so the team does not confuse unrecoverable internal code with ordinary missing source.
4. Import or recreate only the smallest donor-backed surface needed for the active runtime path.
5. Use repository-wide `tsc` to locate the next blocker cluster, but only promote an error to active work when it blocks the runnable baseline or clearly reduces missing-module pressure.

This strategy intentionally avoids the previous failure mode where the team spent large effort on manual file-by-file `tsc` cleanup without first establishing a stable restoration model.

## Decisions

### 1. Define a restoration baseline around runnable source entrypoints, not full type cleanliness

The first completion target SHALL be a minimal source-entry runtime path that can execute startup-oriented flows such as `--version`, `--help`, and a constrained interactive or print-mode bootstrap.

Rationale:
- The strongest current signal is runtime divergence between the prebuilt artifact and the reconstructed source tree.
- Full-repository type cleanup is too broad and mixes runtime blockers with lower-value type drift.

Alternatives considered:
- Continue repository-wide `tsc` cleanup first. Rejected because current error volume is too broad and includes non-runtime-critical debt.
- Use only the prebuilt `cli.js`. Rejected because future enterprise changes need a source-level implementation base.

### 2. Handle missing modules by category instead of using one repair strategy

Every missing import SHALL be classified into one of four categories:
- runtime-critical implementation required
- runtime-safe shim/stub
- type-only shim/declaration
- explicitly disabled/guarded feature

Rationale:
- The mirrored repository references modules that were removed by Bun dead-code elimination and are not recoverable from published artifacts.
- Treating all missing imports as if they require real implementations leads to wasted effort and incorrect recovery assumptions.
- The external runnable fork shows that selective shims and guards are enough to restore active startup paths without recreating the entire internal feature surface.

Alternatives considered:
- Recreate every missing module. Rejected because many modules are internal-only and unrecoverable.
- Blanket-ignore missing imports in TypeScript. Rejected because some imports are on active runtime paths.

### 3. Restore build-time compatibility explicitly

The source runtime SHALL include a small compatibility layer for:
- `MACRO.*` access
- `feature()` / Bun compile-time assumptions
- other source-entry expectations that were previously satisfied only by the bundle/build system

Rationale:
- Current source execution fails before meaningful runtime validation because those assumptions are unresolved.

Alternatives considered:
- Patch each callsite independently. Rejected because the failure source is cross-cutting and should be handled centrally where possible.

### 4. Use a constrained runnable validation matrix

Restoration validation SHALL be split into:
- source-entry runtime checks
- targeted type validation for active restoration paths
- optional repository-wide `tsc` monitoring recorded as debt, not as the immediate gate

Rationale:
- This keeps validation aligned with restoration goals and avoids blocking on unrelated reconstructed-source drift.
- It also provides a way to continue making progress even when the repository still contains large classes of deferred errors that are structurally expected in a mirrored source tree.

Alternatives considered:
- Single validation gate using full `tsc`. Rejected because it obscures restoration progress and encourages low-signal cleanup work.

### 5. Use the external runnable fork as a donor reference, not as a merge target

The external repaired fork may be used to identify candidate shims, guards, and missing file groups, but each adoption SHALL be reviewed against this repository's current OpenSpec direction.

Rationale:
- It contains useful restoration decisions and missing files, but this repository already has enterprise/provider changes that differ from a pure restoration fork.

## Practical Triage Rules

When a new error or missing import is encountered, use the following order:

1. Does it break a defined runnable-source command such as `--version`, `--help`, startup bootstrap, or the current active validation path?
If yes, treat it as active restoration work.

2. Is it a cross-cutting compatibility issue such as `MACRO`, `feature()`, generated declarations, or missing published-artifact shims?
If yes, prefer a central fix or shared shim over patching many callsites.

3. Is it an internal-only or feature-gated path that is not on the runnable baseline?
If yes, prefer an explicit guard, placeholder, or deferred classification.

4. Is it a broad repository-wide typing issue that does not block runtime?
If yes, record it as debt and only work it in grouped clusters when it materially reduces active-path noise.

## Risks / Trade-offs

- [A shim hides a real unsupported feature] -> Require feature classification and explicit notes when a feature is guarded or degraded.
- [Donor fork code conflicts with current repository changes] -> Import grouped fixes selectively and review diffs before adoption.
- [Runtime baseline succeeds while latent paths still fail later] -> Validate a small set of representative flows and keep unsupported paths explicitly documented.
- [Team keeps using full `tsc` as the success metric] -> Add restoration-validation requirements and task gates that separate baseline readiness from long-tail cleanup.
- [Too many local declarations mask type mistakes] -> Limit type-only shims to clearly missing published artifacts or external package declarations and keep them discoverable.

## Migration Plan

1. Establish the runnable-source baseline definition and artifact-backed validation rules.
2. Inventory active runtime blockers in source entrypoints and startup flows.
3. Add central compatibility shims for build-time macros and feature gating.
4. Restore or shim runtime-critical missing modules on the active startup path.
5. Add targeted validation commands for source runtime and active-path type checking.
6. Reclassify remaining full-repository `tsc` failures as deferred restoration debt unless they block the defined runtime baseline.

## Open Questions

- Which source entry flow should be the formal minimum bar beyond `--version` and `--help`: print mode, interactive REPL startup, or both?
- Should the runtime baseline use a dedicated `tsconfig.runtime.json`, or a scripted filtered `tsc` entry list?
- Which currently missing modules are on the true startup critical path versus only reachable from optional commands or feature-gated flows?
