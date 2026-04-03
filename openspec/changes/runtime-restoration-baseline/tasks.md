## 1. Baseline Definition

- [x] 1.1 Define the runnable-from-source baseline commands and startup flows that count as restoration success.
- [x] 1.2 Record the current blocker inventory for those baseline flows, separating macro/build-time failures, missing-module failures, and ordinary type drift.
- [x] 1.3 Update the execution record format in [implementation.md](d:/Code/Junclaw/claude-code-source/openspec/changes/implementation.md) to distinguish baseline blockers from deferred repository-wide type debt.

## 2. Source Runtime Compatibility

- [x] 2.1 Add the compatibility layer required for source execution of build-time globals such as `MACRO`.
- [x] 2.2 Add a restoration strategy for Bun `feature()` assumptions on active startup paths.
- [x] 2.3 Validate that source entrypoints can execute baseline startup commands without bundle-time injection failures.

## 3. Missing Module Classification And Repair

- [x] 3.1 Build a categorized inventory of missing modules on the runnable baseline path: implementation, runtime shim, type-only shim, or explicit guard.
- [x] 3.2 Restore or shim the runtime-critical missing modules required by the baseline source flows.
- [x] 3.3 Add explicit guards or degraded behavior for missing internal-only or feature-gated paths that are out of scope for the baseline.

## 4. Targeted Validation

- [x] 4.1 Add a targeted validation command or config for active restoration paths, separate from full-repository `tsc`.
- [x] 4.2 Run runtime validation for the defined source baseline flows and record the observed results.
- [x] 4.3 Run repository-wide `tsc` as a monitoring signal only, then document the remaining deferred error classes and next clusters.

## 5. Donor Comparison Follow-up

- [x] 5.1 Compare the current repository against the external runnable fork and group donor candidates by startup-critical, validation-critical, and deferred.
- [x] 5.2 Import or recreate the approved startup-critical donor fixes with review against this repository's existing provider changes.
- [x] 5.3 Re-validate the runnable baseline after donor-based repairs and update the restoration status in the execution record.
