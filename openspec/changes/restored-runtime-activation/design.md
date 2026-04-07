## Context

The repository has already completed the first restoration phase: source `--version`, source `--help`, prebuilt version parity, and `validate:restoration` all pass. A later donor-infrastructure pass added `src/dev-entry.ts`, local shim packages, and dependency restoration so development runs could proceed from a controlled launcher rather than failing immediately.

Current validation shows that this launcher still reports unresolved relative imports and intentionally refuses to forward to `src/entrypoints/cli.tsx` while they remain. Separately, the direct source runtime can still stall on a minimal `--bare -p` flow even after startup completes. Those are two different problems:

- runtime activation: the direct source entry path must complete a minimal request flow
- missing-import triage: unresolved relative imports must be classified so follow-up work can be done in grouped buckets rather than ad hoc cleanup

This change therefore starts a new follow-up phase instead of continuing to stretch either `runtime-restoration-baseline` or `high-yield-debt-reduction` beyond their current boundaries.

## Goals / Non-Goals

**Goals:**
- Define the minimum direct source runtime gate beyond startup-only baseline commands.
- Isolate the next blocker on the `src/entrypoints/cli.tsx --bare -p ...` path until the flow either succeeds or fails with a narrow actionable cause.
- Produce an authoritative inventory of unresolved relative imports from the restoration launcher.
- Classify each unresolved relative import into `restore`, `shim`, `guard`, or `defer` so implementation can be planned by treatment bucket.
- Define the condition under which `src/dev-entry.ts` is allowed to forward into the real CLI entrypoint.

**Non-Goals:**
- Eliminate all repository-wide TypeScript errors.
- Fully implement every missing internal or feature-gated module removed from the published artifact by Bun dead-code elimination.
- Reopen broad telemetry rewrites or unrelated type-cleanup clusters.
- Require the unresolved import count to reach zero within this change.

## Decisions

### 1. Treat runtime activation as a new phase, not as residual debt cleanup

The direct source runtime SHALL be treated as its own execution target rather than as an implicit subtask of debt reduction.

Rationale:
- `high-yield-debt-reduction` is about leverage and treatment strategy, not about declaring the direct runtime operational.
- The current blocker is not repository-wide debt volume; it is an active-path runtime gap.

Alternatives considered:
- Continue folding runtime activation into debt-reduction work. Rejected because it keeps runtime blockers mixed with broad maintenance debt.

### 2. Use a bounded runtime gate instead of `bun run dev` as the primary success metric

The primary activation gate SHALL be direct source entry validation through:

- `bun src/entrypoints/cli.tsx --version`
- `bun src/entrypoints/cli.tsx --help`
- `npm run validate:restoration`
- `bun src/entrypoints/cli.tsx --bare -p "Say OK only."`

`bun run dev` SHALL be treated as a restoration launcher diagnostic until its forwarding criteria are explicitly satisfied.

Rationale:
- The current `dev` script is intentionally gated by unresolved imports and is not the real product runtime today.
- The direct print path is the narrowest meaningful runtime check beyond startup.

Alternatives considered:
- Use `bun run dev` as the activation gate. Rejected because current launcher behavior intentionally blocks forwarding before real runtime execution.

### 3. Classify unresolved imports by treatment type before implementation

Each unresolved relative import reported by `src/dev-entry.ts` SHALL be assigned one of four treatment classes:

- `restore`: recover a real file or donor-backed implementation needed for an active path
- `shim`: supply a minimal compatibility surface for a package-boundary or native/private dependency gap
- `guard`: block or degrade an unrecoverable optional/internal feature so startup and active flows remain safe
- `defer`: leave unresolved for a later phase because the path is not required for the current runtime gate

Rationale:
- Not every unresolved import deserves the same repair strategy.
- This repository is a source mirror with structurally absent modules; classification is required to avoid wasted effort.

Alternatives considered:
- Drive missing-import work directly from count reduction. Rejected because it encourages low-signal one-off fixes.

### 4. Forwarding criteria must be explicit and tied to active-path safety

The change SHALL define the exact conditions under which `src/dev-entry.ts` may forward into `src/entrypoints/cli.tsx`.

Rationale:
- Today the launcher acts as a scanner and early-exit gate, but the repo lacks a formal rule for when forwarding becomes valid.
- Without an explicit rule, developers can misread `bun run dev` failure as either a regression or a completed runtime blocker.

Alternatives considered:
- Remove the gate and always forward. Rejected because unresolved imports may still hide active-path runtime failures and would make diagnostics noisier.

## Risks / Trade-offs

- [Launcher inventory misses dynamically resolved paths] -> Use the launcher inventory as the authoritative static list for this phase, then record any runtime-discovered gaps separately.
- [A deferred import later appears on the active runtime path] -> Reclassify it immediately and update the inventory rather than forcing the old bucket to remain stable.
- [The direct print path stalls without a clean exception] -> Add focused runtime tracing and treat the result as a narrow blocker rather than reopening broad debt work.
- [Developers keep treating `bun run dev` as the product entrypoint] -> Document the launcher role and forwarding criteria in the change artifacts and implementation record.

## Migration Plan

1. Keep `runtime-restoration-baseline` as the completed baseline contract.
2. Keep `high-yield-debt-reduction` scoped to donor infrastructure alignment and prior debt decisions.
3. Use this change to isolate the next direct runtime blocker on the `--bare -p` path.
4. Generate the unresolved-import inventory from `src/dev-entry.ts` and assign treatment classes.
5. Create grouped follow-up buckets for `restore`, `shim`, `guard`, and `defer` work.
6. Reassess whether `bun run dev` should remain a scanner, become a forwarding launcher, or split into two explicit scripts after classification is complete.

## Open Questions

- Should `bun run dev` remain scanner-first even after the direct print path is activated, or should scanning move to a dedicated script?
- Is launcher forwarding allowed only when active-path unresolved imports reach zero, or when all remaining unresolved imports are formally classified as non-blocking?
- After the current `--bare -p` stall is isolated, should interactive runtime activation stay in this change or move to a separate follow-up?