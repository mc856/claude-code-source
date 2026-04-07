## Why

The current `runtime-restoration-baseline` change established a runnable source baseline, but repository-wide debt still makes normal maintenance expensive and unpredictable. The next phase needs a narrower follow-up change that reduces the highest-cost debt clusters without reopening the broader source-restoration scope.

## What Changes

- Define a second-phase debt-reduction track that starts from the existing runnable baseline instead of treating the repository as a full reconstruction effort.
- Prioritize localized rewrites or compatibility-layer replacements for high-yield clusters where continued file-by-file typing cleanup is lower leverage.
- Establish triage rules that separate modules worth refactoring from modules that should stay shimmed, guarded, or deferred.
- Require that debt-reduction work preserve the existing runnable validation baseline while improving maintainability in selected clusters.
- Keep the completed `permissions/rules` cleanup as a local debt-reduction win, then pivot the remaining work to donor restoration infrastructure alignment instead of continuing source-level telemetry rewrites.
- Treat the donor restoration sample as a higher-leverage baseline for dependency restoration, local native/private package shims, vendor replacements, and development entry behavior.

## Capabilities

### New Capabilities
- `high-yield-debt-reduction`: Plan and execute cluster-scoped debt reduction work that improves maintainability without expanding back into full-source reconstruction.
- `debt-cluster-validation`: Define validation rules for debt-reduction work so refactors preserve the runnable baseline and record measurable improvement in the targeted cluster.

### Modified Capabilities

## Impact

- Affects OpenSpec planning and execution boundaries after `runtime-restoration-baseline`.
- Affects `src/components/permissions/rules/*` and adjacent permission-management UI flows.
- Affects dependency restoration, `shims/*`, `vendor/*`, restoration launcher behavior, and telemetry/native import compatibility that can be solved at package boundaries.
- Affects how repository-wide `tsc` output is interpreted, grouped, and used for follow-on work.
