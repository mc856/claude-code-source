## Why

The repository is a source mirror reconstructed from a bundled Claude Code release rather than a complete buildable upstream source tree. Recent validation shows that the prebuilt `cli.js` runs, but the reconstructed `src/` tree still fails on build-time macros, feature-gated missing modules, and a large volume of non-runtime-blocking TypeScript drift, so the team needs a restoration plan that targets a runnable baseline instead of continuing ad hoc file-by-file `tsc` cleanup.

## What Changes

- Define a restoration baseline for the reconstructed source tree so the project can reach a known-good "runnable from source" target before broader cleanup continues.
- Establish required runtime shims and guards for Bun compile-time intrinsics, injected macros, and feature-gated modules that are absent from the published artifact.
- Define how missing modules must be handled by category: real implementation, minimal runtime shim, type-only shim, or explicit feature gate.
- Introduce layered validation rules that distinguish source-entry runtime validation from full-repository type validation.
- Capture the rule that repository-wide `tsc` cleanliness is not the immediate completion gate for restoration work.

## Strategy Summary

This change follows a "runnable restoration" strategy rather than a "full source reconstruction" strategy:

- accept that the mirrored `src/` tree is incomplete because Bun compile-time feature elimination removed 100+ internal or gated modules from the published artifact
- restore a minimal runnable source baseline first, instead of treating repository-wide `tsc` cleanup as the primary goal
- classify missing imports before repairing them: real implementation, runtime shim, type-only shim, or explicit guard
- use donor code selectively as a restoration reference, not as an authoritative merge target
- treat repository-wide `tsc` as a monitoring signal that helps identify the next repair cluster, not as the near-term completion gate

In practice, this means the team should prefer:

- central compatibility fixes over repeated local workarounds
- startup-path repairs over broad type-only cleanup
- explicit degraded behavior over pretending unrecoverable internal features are fully implemented
- grouped repair passes by blocker class over unbounded file-by-file error chasing

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
