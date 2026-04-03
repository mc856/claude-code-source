## Why

The current `runtime-restoration-baseline` change established a runnable source baseline, but repository-wide debt still makes normal maintenance expensive and unpredictable. The next phase needs a narrower follow-up change that reduces the highest-cost debt clusters without reopening the broader source-restoration scope.

## What Changes

- Define a second-phase debt-reduction track that starts from the existing runnable baseline instead of treating the repository as a full reconstruction effort.
- Prioritize localized rewrites or compatibility-layer replacements for high-yield clusters where continued file-by-file typing cleanup is lower leverage.
- Establish triage rules that separate modules worth refactoring from modules that should stay shimmed, guarded, or deferred.
- Require that debt-reduction work preserve the existing runnable validation baseline while improving maintainability in selected clusters.
- Focus initial implementation scope on the `permissions/rules` UI cluster and the telemetry compatibility layer, with room to add later clusters only after validation.

## Capabilities

### New Capabilities
- `high-yield-debt-reduction`: Plan and execute cluster-scoped debt reduction work that improves maintainability without expanding back into full-source reconstruction.
- `debt-cluster-validation`: Define validation rules for debt-reduction work so refactors preserve the runnable baseline and record measurable improvement in the targeted cluster.

### Modified Capabilities

## Impact

- Affects OpenSpec planning and execution boundaries after `runtime-restoration-baseline`.
- Affects `src/components/permissions/rules/*` and adjacent permission-management UI flows.
- Affects `src/utils/telemetry/*` and any compatibility shims or adapters those modules depend on.
- Affects how repository-wide `tsc` output is interpreted, grouped, and used for follow-on work.
