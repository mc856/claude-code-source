## Why

The repository is a source mirror reconstructed from a bundled Claude Code release rather than a complete buildable upstream source tree. Recent validation shows that the prebuilt `cli.js` runs, but the reconstructed `src/` tree still fails on build-time macros, feature-gated missing modules, and a large volume of non-runtime-blocking TypeScript drift, so the team needs a restoration plan that targets a runnable baseline instead of continuing ad hoc file-by-file `tsc` cleanup.

## What Changes

- Define a restoration baseline for the reconstructed source tree so the project can reach a known-good "runnable from source" target before broader cleanup continues.
- Establish required runtime shims and guards for Bun compile-time intrinsics, injected macros, and feature-gated modules that are absent from the published artifact.
- Define how missing modules must be handled by category: real implementation, minimal runtime shim, type-only shim, or explicit feature gate.
- Introduce layered validation rules that distinguish source-entry runtime validation from full-repository type validation.
- Capture the rule that repository-wide `tsc` cleanliness is not the immediate completion gate for restoration work.

## Capabilities

### New Capabilities
- `runtime-restoration`: Restoring the reconstructed source tree to a minimal runnable state with explicit runtime boundaries, shims, and missing-module handling.
- `restoration-validation`: Validation rules for source-restoration work, including runnable-source checks, targeted type checks, and separation from full-repository type debt.

### Modified Capabilities

## Impact

- Affects CLI/source entrypoints, startup/bootstrap flows, and REPL initialization paths.
- Affects build-time compatibility layers for `MACRO`, `feature()`-gated code, and other Bun-specific behavior.
- Affects missing-module handling across tools, components, constants, and type surfaces referenced by the reconstructed source tree.
- Changes how restoration progress is measured, validated, and declared complete in OpenSpec execution records.
