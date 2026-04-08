## 1. Phase Boundary

- [x] 1.1 Record the phase-1 closure point so runtime activation is not reopened implicitly during phase-2 cleanup.
- [x] 1.2 Reconfirm the phase-2 regression boundary using the normal non-bare launcher path rather than raw missing-import totals.
- [x] 1.3 Document that bare-mode OAuth absence is expected behavior, not a restore defect.

## 2. Active-Path Placeholder Hardening

- [x] 2.1 Refresh the current inventory and identify which remaining placeholders are still exercised by active non-bare runtime or validation paths.
- [x] 2.2 Replace any still-too-thin active-path placeholder with the smallest stable contract its current consumers require.
- [x] 2.3 Re-run targeted import/runtime validation after each bounded hardening bucket.

## 3. Guard / Defer Consolidation

- [x] 3.1 Audit the current `guard` bucket and keep only intentionally unsupported internal or optional surfaces there.
- [x] 3.2 Audit the current `defer` bucket and keep only documentation-heavy or non-essential auxiliary assets there.
- [x] 3.3 Update inventory and implementation notes so future work can distinguish real runtime surfaces from intentional mirror gaps.

## 4. Completion Check

- [x] 4.1 Re-run the normal launcher validation commands and record the final phase-2 result.
- [x] 4.2 Summarize which remaining gaps are intentionally preserved for later phases versus which were actually reduced in this phase.
- [x] 4.3 Decide whether the completed phase should be archived immediately or left open pending adjacent follow-up work.