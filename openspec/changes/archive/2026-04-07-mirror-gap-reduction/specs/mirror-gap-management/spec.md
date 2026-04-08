## ADDED Requirements

### Requirement: Remaining mirror gaps are managed by explicit treatment bucket
The repository SHALL manage post-activation mirror gaps through explicit `restore`, `shim`, `guard`, or `defer` classifications rather than through raw missing-import totals alone.

#### Scenario: Planning follow-up work after runtime activation
- **WHEN** a remaining source, asset, or compatibility gap is identified after the normal launcher path is already working
- **THEN** the gap SHALL be recorded under one of the four treatment buckets
- **AND** the rationale SHALL state whether the surface is runtime-adjacent, compatibility-only, internal/optional, or intentionally out of scope

### Requirement: Post-activation gap reduction preserves the validated launcher path
The system SHALL treat the working normal launcher path as the regression boundary during post-activation mirror-gap reduction.

#### Scenario: Validating a bounded reduction bucket
- **WHEN** a restore, shim, or guard bucket is implemented
- **THEN** validation SHALL confirm that `bun run ./src/dev-entry.ts --version` still succeeds
- **AND** validation SHALL confirm that `bun run ./src/dev-entry.ts -p "Say OK only."` still reaches a successful normal non-bare response in the local environment
- **AND** validation SHALL distinguish any `--bare` auth failure from a restored-source runtime regression

### Requirement: Intentionally guarded and deferred surfaces remain documented
The repository SHALL document guarded and deferred mirror gaps that are intentionally not part of the minimum supported mirror behavior.

#### Scenario: Encountering an internal or optional surface during phase-2 cleanup
- **WHEN** a missing or degraded surface is determined to be internal-only, optional, or documentation-only
- **THEN** the change record SHALL preserve it as `guard` or `defer`
- **AND** the follow-up notes SHALL explain why it is not being restored for the current supported mirror runtime