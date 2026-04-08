## Context

`restored-runtime-activation` has already completed the first-phase goal: the restored launcher now forwards into the real CLI, `bun run ./src/dev-entry.ts --version` returns the real version, and non-bare `-p` execution succeeds in the local environment. The remaining mirror gaps are no longer a single startup blocker. They are a mixed maintenance surface spanning ordinary source gaps, intentionally degraded internal guards, compatibility shims, and documentation-heavy assets that do not belong in the minimum runtime gate.

The risk in this phase is not that the runtime is still broken; the risk is that future cleanup reverts to chasing raw import counts and accidentally reopens solved runtime paths or spends time restoring internal-only surfaces that should remain guarded.

## Goals / Non-Goals

**Goals:**
- Keep the normal restored launcher path working while reducing the remaining mirror-gap surface.
- Execute remaining work by explicit `restore` / `shim` / `guard` / `defer` buckets.
- Strengthen any thin placeholder that still leaks into active non-bare runtime or validation paths.
- Make guard/defer decisions durable so future contributors do not reclassify intentional gaps as urgent runtime defects.

**Non-Goals:**
- Reopening the completed runtime-activation investigation.
- Treating `--bare` OAuth absence as a defect.
- Restoring every missing upstream file for parity with donor source.
- Using repository-wide `tsc` cleanliness as the acceptance gate for this phase.

## Decisions

### Decision: Use runtime-preserving bucket execution, not raw-count reduction

The remaining missing surfaces are heterogeneous. Some are ordinary support files, some are intentionally degraded internal features, and some are documentation bundles. This phase will keep the existing classifications and only move work through bounded buckets so each change can be validated against its actual runtime relevance.

Alternative considered:
- Continue reducing raw missing-import totals. Rejected because it obscures runtime relevance and invites speculative restoration of internal-only surfaces.

### Decision: Treat the normal launcher path as the regression boundary

The source runtime is considered active for this phase when the following stay healthy:
- `bun run ./src/dev-entry.ts --version`
- `bun run ./src/dev-entry.ts -p "Say OK only."`
- `npm run validate:restoration`

`--bare` remains useful for narrow validation, but its OAuth-disabled behavior is not a regression signal.

Alternative considered:
- Keep using `--bare -p` as the single gate. Rejected because it intentionally changes auth behavior and is no longer representative of the normal launcher path.

### Decision: Distinguish thin active-path placeholders from intentional guards

Some first-phase files were created as minimal placeholders to unblock forwarding. In this phase, placeholders used by active non-bare flows should be completed to the smallest stable contract their consumers require. By contrast, explicitly internal or optional surfaces should remain guarded and documented rather than being speculatively recreated.

Alternative considered:
- Upgrade every stub toward donor parity. Rejected because many guarded surfaces are intentionally unsupported or out of scope for the restored mirror.

## Risks / Trade-offs

- [Risk] A placeholder that looked inactive may still be exercised by a normal runtime path. → Mitigation: validate import and runtime behavior after each bounded bucket, not only at the end.
- [Risk] The boundary between `guard` and `restore` may drift over time. → Mitigation: keep the inventory updated with rationale, not only file names.
- [Risk] Future work may misread bare-mode auth failure as a restoration regression. → Mitigation: document the non-goal explicitly in the change and in validation notes.
- [Risk] Because main specs are still empty, the change contract lives entirely in delta specs. → Mitigation: keep capability names narrow and requirement text concrete so later archive/sync remains straightforward.

## Migration Plan

1. Preserve the completed `restored-runtime-activation` record as the phase-1 closure point.
2. Refresh the current inventory and identify which remaining placeholders are still on active non-bare paths.
3. Execute one bounded bucket at a time, validating the normal launcher path after each bucket.
4. Update the inventory and implementation notes so unresolved guard/defer surfaces remain intentionally classified.

## Open Questions

- Which current phase-1 placeholders are still thinner than their active non-bare consumers really require?
- Should the remaining SSH / REPL adjunct gaps stay permanently guarded, or is there a later phase where they become part of supported mirror behavior?
- Once this phase is complete, should completed changes be archived immediately or batched together after follow-up provider validation work?