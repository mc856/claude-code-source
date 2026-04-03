## 1. Cluster Triage

- [ ] 1.1 Define the first implementation clusters and assign each one a treatment type: localized rewrite, compatibility-layer replacement, or bounded type-surface cleanup
- [ ] 1.2 Record which currently noisy modules are explicitly deferred because they belong to core runtime or low-value shim territory

## 2. Permissions Rules Cluster

- [ ] 2.1 Re-map `src/components/permissions/rules/*` into bounded subareas and choose whether each subarea will be rewritten or cleaned up in place
- [ ] 2.2 Implement the first `permissions/rules` refactor pass without changing permission persistence behavior or the runnable baseline
- [ ] 2.3 Validate the `permissions/rules` pass with runnable baseline checks and localized TypeScript/error-surface comparison

## 3. Telemetry Cluster

- [ ] 3.1 Define the supported telemetry compatibility surface for this repository phase and defer unsupported exporter paths explicitly
- [ ] 3.2 Implement the telemetry compatibility-layer replacement or bounded rewrite for the selected surface
- [ ] 3.3 Validate telemetry behavior and record the local reduction in dependency/export mismatch debt

## 4. Execution Record And Follow-up

- [ ] 4.1 Update `openspec/changes/implementation.md` with cluster treatment decisions, validation results, and deferred debt inventory
- [ ] 4.2 Reassess whether a third cluster should be opened in a later change or left deferred after the first two clusters land
