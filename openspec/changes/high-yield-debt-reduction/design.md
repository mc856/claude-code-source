## Context

The repository now has a working runnable-source baseline, but long-tail debt still distorts maintenance cost. The remaining error surface is not uniform: some areas are mostly decompiled-source type drift, some are version-mismatch compatibility problems, and some are low-value feature-gated gaps that should remain shimmed.

Recent review shows two clusters with unusually high return on targeted restructuring:

- `src/components/permissions/rules/*`
  - many related UI files
  - heavy callback and state typing drift
  - localized behavior that can be rewritten without touching the main runtime core
- `src/utils/telemetry/*`
  - significant dependency/export mismatch
  - compatibility drift concentrated around adapter boundaries
  - lower user-visible product risk than rewriting core CLI/session flows

This phase must not silently expand back into a repo-wide cleanup effort. It should use the runnable baseline created by `runtime-restoration-baseline` as a hard boundary and only take on debt work with clear leverage.

## Goals / Non-Goals

**Goals:**
- Define a repeatable triage model for deciding whether a debt cluster should be rewritten, shimmed, or deferred.
- Reduce maintenance cost in selected high-yield clusters while keeping product behavior stable.
- Preserve the current runnable-source validation baseline throughout the refactor work.
- Measure progress by cluster-level improvement, not by whole-repo type cleanliness.
- Create a path for follow-on debt work that is explicitly modular and bounded.

**Non-Goals:**
- Achieve full-repository `tsc` success in this change.
- Rewrite core runtime flows such as entrypoints, app state, session storage, task framework, or model/tool execution pipelines.
- Replace every decompiled-source artifact that still has weak typing.
- Treat all remaining TypeScript errors as equally valuable to fix.

## Decisions

### 1. Use cluster-scoped debt reduction instead of repo-wide cleanup

Debt work SHALL be organized around bounded clusters with a named owner surface, rather than around raw `tsc` error lists.

Rationale:
- The current error surface is too broad to act on directly.
- Cluster boundaries make validation and rollback practical.
- This avoids returning to low-signal file-by-file cleanup.

Alternatives considered:
- Continue top-down repo-wide `tsc` cleanup. Rejected because it recreates the same low-leverage workflow.

### 2. Start with `permissions/rules` and telemetry

The first targeted clusters SHALL be:
- `src/components/permissions/rules/*`
- `src/utils/telemetry/*`

Rationale:
- Both clusters have concentrated debt and limited blast radius relative to core runtime systems.
- `permissions/rules` is a strong candidate for localized component cleanup or rewrite.
- telemetry is a strong candidate for compatibility-layer replacement because much of its debt comes from dependency/API drift rather than product-defining behavior.

Alternatives considered:
- Start with `sessionStorage`, task framework, or provider/session core. Rejected because those modules are more behavior-critical and riskier to rewrite.

### 3. Choose one of three treatments for each cluster

Each targeted cluster SHALL be assigned one primary treatment:
- localized rewrite
- compatibility-layer replacement
- bounded type-surface cleanup

Rationale:
- Different clusters fail for different reasons.
- Forcing every cluster into a single “fix typings” workflow leads to poor results.

Alternatives considered:
- Default every cluster to local typing cleanup. Rejected because some areas are structurally easier to rewrite than to patch.

### 4. Keep the runnable baseline as the hard gate

Every debt-reduction pass SHALL preserve:
- `bun src/entrypoints/cli.tsx --version`
- `bun src/entrypoints/cli.tsx --help`
- `node cli.js --version`
- `npm run validate:restoration`

Rationale:
- This prevents cleanup work from regressing the restoration milestone already achieved.
- It keeps follow-on work aligned with the first-phase contract.

Alternatives considered:
- Use only cluster-local validation. Rejected because regressions can escape into startup paths through shared imports.

### 5. Measure output by maintainability and local error reduction, not only global counts

A cluster is considered improved when:
- its code structure is materially simpler or better bounded than before
- its targeted validation passes
- its local `tsc` error pressure is reduced
- the runnable baseline remains green

Rationale:
- Whole-repo TypeScript counts can hide whether the touched area is actually healthier.
- The team needs evidence that refactor effort reduced future maintenance cost.

Alternatives considered:
- Use only global error deltas. Rejected because they do not capture localized wins reliably.

## Risks / Trade-offs

- [A “local rewrite” drifts from current behavior] → Keep rewrites bounded to localized clusters and validate against existing user-visible flows.
- [Debt work expands back into broad cleanup] → Require explicit cluster selection before implementation and defer unrelated errors.
- [Telemetry changes mask unsupported dependency combinations] → Use compatibility boundaries and document degraded/unsupported exporter paths.
- [Permission UI refactor leaks into core permission model changes] → Keep data-shape and persistence behavior stable unless a separate proposal changes requirements.
- [Global `tsc` still looks noisy after local wins] → Record cluster-level results explicitly instead of treating unchanged global debt as failure.

## Migration Plan

1. Keep `runtime-restoration-baseline` as the finished first-phase baseline.
2. Inventory the first two high-yield clusters and record their treatment type.
3. Implement cluster-by-cluster changes behind the existing runnable validation gate.
4. Re-run baseline validation after each cluster pass and record local `tsc` changes.
5. Defer untouched repo-wide debt to later bounded follow-up changes.

## Open Questions

- Should `permissions/rules` be treated as one refactor unit or split into list-management and per-dialog subclusters?
- Should telemetry target a minimal supported exporter subset first, or maintain placeholder support for all referenced exporter types?
- Is a dedicated filtered TypeScript command needed for cluster-level validation, or is file-scoped monitoring sufficient for this phase?
