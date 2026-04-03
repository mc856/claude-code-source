## ADDED Requirements

### Requirement: Source entrypoints SHALL run behind a restoration compatibility layer
The system SHALL provide the compatibility behavior required for the reconstructed source tree to execute defined source entrypoint flows without depending on unavailable bundle-time injection. The compatibility layer MUST cover build-time macro access, Bun feature-gating assumptions, and other startup-critical published-artifact gaps on the active runtime path.

#### Scenario: Source version command executes from source
- **WHEN** an operator runs the defined source entry command for version output
- **THEN** the command SHALL return version information without failing on unresolved build-time globals such as `MACRO`

#### Scenario: Startup path encounters an unavailable feature-gated dependency
- **WHEN** a source startup path reaches code that references a module absent from the published artifact
- **THEN** the system SHALL either provide a runtime-safe shim or block that path behind an explicit guard instead of crashing with an unresolved module error

### Requirement: Missing modules SHALL be classified before repair
The restoration workflow SHALL classify each missing module encountered on an active path as one of: runtime implementation required, runtime-safe shim, type-only shim, or explicit feature guard. The team MUST NOT assume that every missing module should be recreated with full implementation behavior.

#### Scenario: Runtime-critical module is missing
- **WHEN** a missing module is required by a defined runnable-source validation path
- **THEN** the module SHALL be restored with a real implementation or a shim that preserves the required runtime contract for that path

#### Scenario: Internal-only feature-gated module is missing
- **WHEN** a missing module belongs to a feature-gated or internal-only path that is not part of the defined runnable baseline
- **THEN** the system SHALL disable or guard that path explicitly rather than blocking restoration on full module recreation

### Requirement: Restoration baseline SHALL target a minimal runnable source flow
The restoration effort SHALL define a small set of source-entry runtime flows that count as the runnable baseline. The team MUST use that baseline to prioritize repair work before attempting repository-wide cleanup.

#### Scenario: Startup work is prioritized
- **WHEN** restoration work is planned
- **THEN** tasks SHALL prioritize source-entry startup and bootstrap blockers ahead of unrelated repository-wide type cleanup

#### Scenario: A non-baseline feature path still fails
- **WHEN** a path outside the defined runnable baseline fails during restoration
- **THEN** the failure SHALL be recorded and triaged, but it SHALL NOT automatically block baseline completion unless it is later added to the baseline
