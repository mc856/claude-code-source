## Context

The repository now has a working runnable-source baseline, but long-tail debt still distorts maintenance cost. The remaining error surface is not uniform: some areas are decompiled-source type drift, some are dependency or package-boundary drift, and some are low-value feature-gated gaps that should remain shimmed.

The first high-yield cluster, `src/components/permissions/rules/*`, has already been treated as a localized rewrite. It was useful for local maintainability, but the later runtime investigation showed that continuing into telemetry source rewrites is lower leverage than aligning the donor restoration infrastructure first.

The external restoration sample appears small at the source level because much of its restoration work lives outside `src`:

- restoration-oriented dependency manifest and lockfile
- local `shims/*` packages for private/native modules
- `vendor/*` TypeScript replacements for native bindings
- `src/dev-entry.ts` for `MACRO` injection and missing-import diagnostics
- a restoration TypeScript posture that does not treat repo-wide strict type cleanup as the first gate

This change now pivots from "telemetry source rewrite" to "donor infrastructure alignment" for the remaining work.

## Goals / Non-Goals

**Goals:**
- Preserve the runnable baseline established by `runtime-restoration-baseline`.
- Keep the completed `permissions/rules` localized rewrite as the first debt-reduction result.
- Align donor restoration infrastructure where it can reduce source-level patching: dependencies, shims, vendor replacements, and dev entry behavior.
- Avoid overwriting current package identity or unrelated runtime fixes when merging donor pieces.
- Reassess telemetry after dependency/package-boundary alignment before deciding whether it needs source-level rewrite.

**Non-Goals:**
- Achieve full-repository `tsc` success in this change.
- Rewrite core runtime flows such as entrypoints, app state, session storage, task framework, or model/tool execution pipelines.
- Blindly replace the current repository with the donor repository.
- Continue broad source-level telemetry rewrites before fixing package-boundary restoration issues.

## Decisions

### 1. Keep debt work cluster-scoped

Debt work SHALL remain organized around bounded clusters with a named owner surface.

Rationale:
- Cluster boundaries make validation and rollback practical.
- This avoids returning to low-signal file-by-file cleanup.

### 2. Treat `permissions/rules` as complete for this phase

The `permissions/rules` cluster SHALL remain the completed localized rewrite result for this change.

Rationale:
- The cluster no longer appears in the current local TypeScript hot path.
- Continuing to expand UI cleanup would distract from the runtime blockers now observed in real `-p` testing.

### 3. Prefer donor infrastructure alignment before telemetry source rewrites

When a debt cluster is caused by missing dependencies, incomplete installed packages, private/native imports, or absent native bindings, the change SHALL prefer infrastructure alignment before source rewrites.

The selected donor infrastructure pieces are:

- dependency surface from donor `package.json`, merged without replacing current package identity
- `shims/*` local packages for private/native modules
- `vendor/*` TypeScript native-binding replacements, reusing existing current files where already present
- `src/dev-entry.ts` behavior for restored development runs and missing import diagnostics
- restoration-oriented TypeScript posture for future validation, not repo-wide strict cleanup

Rationale:
- The donor sample's small source patch count depends on this infrastructure.
- Current OpenTelemetry and native import failures are package-boundary symptoms, not necessarily source design problems.
- Solving these once at package/runtime boundaries is lower risk than scattered source patches.

Alternatives considered:
- Continue telemetry source rewrites. Rejected because current telemetry failures are largely explained by incomplete dependency installation and package entrypoint drift.
- Copy the donor repository wholesale. Rejected because this would discard current package metadata and previously completed fixes.

### 4. Keep the runnable baseline as the hard gate

Every infrastructure pass SHALL preserve:

- `bun src/entrypoints/cli.tsx --version`
- `bun src/entrypoints/cli.tsx --help`
- `node cli.js --version`
- `npm run validate:restoration`

Rationale:
- This prevents cleanup work from regressing the restoration milestone already achieved.
- It keeps follow-on work aligned with the first-phase contract.

### 5. Measure output by runtime leverage and local error reduction

A pass is considered improved when:

- package-level or shim-level blockers are reduced
- runnable baseline remains green
- real runtime testing gets farther than before or produces a narrower blocker
- unrelated repo-wide TypeScript debt remains explicitly deferred

## Risks / Trade-offs

- [Donor dependency versions drift] -> Prefer lockfile-based install or record when fresh dependency resolution is used.
- [Local shims hide unsupported functionality] -> Keep shim behavior explicitly degraded and document it.
- [Package merge overwrites current metadata] -> Merge dependencies/scripts only; preserve current package name, version, bin, license, and validation script.
- [Telemetry still hangs after dependency alignment] -> Treat that as a narrower runtime follow-up, not proof that source rewrites should resume broadly.
- [Global `tsc` still looks noisy] -> Record cluster-level results instead of treating unchanged global debt as failure.

## Migration Plan

1. Preserve `runtime-restoration-baseline` as the finished first-phase baseline.
2. Keep the completed `permissions/rules` cleanup as done.
3. Migrate donor infrastructure in bounded pieces: `shims/*`, `vendor/*`, dependency surface, and dev-entry behavior.
4. Re-run runnable baseline validation after the infrastructure pass.
5. Re-test the real `-p` startup path and inspect whether telemetry/native import blockers remain.
6. Decide whether telemetry needs a separate source-level follow-up after infrastructure alignment.

## Open Questions

- Should the repo use donor `bun.lock` directly, or regenerate `bun.lock` from the merged dependency manifest?
- Should `src/dev-entry.ts` become the primary `bun run dev` path while `src/entrypoints/cli.tsx` remains the direct baseline path?
- After dependency restoration, is telemetry still a source-code problem or only a runtime configuration problem?
