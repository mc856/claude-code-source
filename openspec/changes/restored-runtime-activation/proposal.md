## Why

The repository already has a runnable restoration baseline, but the real source runtime is still not activated end-to-end. `bun run dev` currently stops inside the restoration launcher because unresolved relative imports are still present, and the direct source print path can still stall after startup rather than completing a minimal request flow.

## What Changes

- Define a new runtime activation phase that treats direct source runtime success as a separate goal from repository-wide debt reduction.
- Establish a minimal runtime gate for the direct source entry path, including a bounded `--bare -p` validation flow that must complete rather than stall.
- Inventory the current unresolved relative imports reported by the restoration launcher and classify each one as restore, shim, guard, or defer.
- Define when `src/dev-entry.ts` acts as a restoration scanner and when it is allowed to forward into the real CLI entrypoint.
- Record follow-up buckets for missing-import work so future implementation can proceed by grouped treatment rather than file-by-file cleanup.

## Capabilities

### New Capabilities
- `runtime-activation`: Define and validate the minimum direct source runtime behavior required to treat the restored source tree as operational beyond baseline startup checks.
- `missing-import-triage`: Define the required inventory, classification rules, and follow-up buckets for unresolved relative imports discovered by the restoration launcher.

### Modified Capabilities

## Impact

- Affects `src/dev-entry.ts`, `src/entrypoints/cli.tsx`, and startup flows used by direct source execution.
- Affects the restoration validation contract and the distinction between baseline startup checks and real runtime activation.
- Affects missing-module handling across `src/`, `vendor/`, and `shims/` where unresolved relative imports are currently blocking launcher forwarding.
- Affects execution planning after `high-yield-debt-reduction`, which should no longer carry runtime activation and missing-import triage as implicit follow-up work.