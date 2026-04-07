## 1. Runtime Activation Gate

- [ ] 1.1 Reconfirm the direct source activation gate and record it separately from the restoration baseline and repository-wide `tsc` monitoring.
- [ ] 1.2 Trace the current `bun src/entrypoints/cli.tsx --bare -p "Say OK only."` stall to the next narrow blocker or successful completion.
- [ ] 1.3 Update execution notes so `bun run dev` is explicitly documented as scanner-only until the forwarding criteria are met.

## 2. Missing Import Inventory

- [ ] 2.1 Capture the current unresolved relative-import inventory emitted by `src/dev-entry.ts`.
- [ ] 2.2 Group unresolved imports by subsystem and active-path relevance instead of treating them as an undifferentiated count.
- [ ] 2.3 Mark which unresolved imports are already known to correspond to Bun-dead-code-eliminated internal or optional features.

## 3. Triage Rules

- [ ] 3.1 Define the treatment rules for `restore`, `shim`, `guard`, and `defer` classifications.
- [ ] 3.2 Apply those rules to the current unresolved-import inventory and record the classification results.
- [ ] 3.3 Identify the smallest `restore` or `guard` bucket that would let the launcher move closer to safe forwarding.

## 4. Follow-up Planning

- [ ] 4.1 Record explicit forwarding criteria for `src/dev-entry.ts` based on active-path safety rather than raw missing-import count alone.
- [ ] 4.2 Convert the classified unresolved imports into grouped follow-up work items rather than file-by-file cleanup tasks.
- [ ] 4.3 Re-run the direct runtime validation commands and record whether runtime activation and launcher behavior improved.