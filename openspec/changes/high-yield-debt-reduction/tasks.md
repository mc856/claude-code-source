## 1. Cluster Triage

- [x] 1.1 Define the first implementation clusters and assign each one a treatment type: localized rewrite, compatibility-layer replacement, or bounded type-surface cleanup
- [x] 1.2 Record which currently noisy modules are explicitly deferred because they belong to core runtime or low-value shim territory

## 2. Permissions Rules Cluster

- [x] 2.1 Re-map `src/components/permissions/rules/*` into bounded subareas and choose whether each subarea will be rewritten or cleaned up in place
- [x] 2.2 Implement the first `permissions/rules` refactor pass without changing permission persistence behavior or the runnable baseline
- [x] 2.3 Validate the `permissions/rules` pass with runnable baseline checks and localized TypeScript/error-surface comparison

## 3. Donor Restoration Infrastructure

- [x] 3.1 Define the donor infrastructure pieces that should replace source-level cleanup: dependency surface, `shims/*`, `vendor/*`, and development entry behavior
- [x] 3.2 Migrate the selected donor infrastructure without overwriting current package identity or unrelated runtime fixes
- [x] 3.3 Validate restored infrastructure with runnable baseline checks and record whether telemetry/native import blockers are reduced

## 4. Execution Record And Follow-up

- [x] 4.1 Update `openspec/changes/implementation.md` with cluster treatment decisions, validation results, and deferred debt inventory
- [x] 4.2 Reassess whether telemetry still needs a dedicated source-level follow-up after donor infrastructure alignment

## 5. Boundary Note

- [x] 5.1 Record that direct runtime activation and unresolved-import triage move to the dedicated `restored-runtime-activation` follow-up change
