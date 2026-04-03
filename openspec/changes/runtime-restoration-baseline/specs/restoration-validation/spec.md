## ADDED Requirements

### Requirement: Restoration validation SHALL distinguish runnable-source success from repository-wide type debt
The system SHALL validate restoration work with a layered validation model that separates runnable-source checks from full-repository type-check debt. Repository-wide type failures MUST NOT be treated as the only readiness signal for source restoration.

#### Scenario: Source runtime passes but full TypeScript still fails
- **WHEN** the defined runnable-source validation flows pass and repository-wide `tsc` still reports unrelated errors
- **THEN** the restoration status SHALL record the source runtime as passing and the remaining full-repository type errors as deferred debt or follow-up work

#### Scenario: Runtime-blocking type issue is found on the active path
- **WHEN** a type or declaration problem blocks a defined runnable-source validation path
- **THEN** that problem SHALL be treated as an active restoration blocker rather than generic background type debt

### Requirement: Restoration tasks SHALL include targeted validation commands
Each restoration task that changes the runnable baseline SHALL record the specific command or validation method used to confirm the affected source path. Validation records MUST distinguish executed runtime checks, executed targeted type checks, and deferred validations.

#### Scenario: A source-entry startup fix lands
- **WHEN** a change repairs startup behavior on the source entry path
- **THEN** the execution record SHALL capture the command used to verify the repaired startup behavior and whether the verification ran against source or prebuilt runtime

#### Scenario: Validation tooling is incomplete
- **WHEN** a desired validation step cannot run because the current environment lacks the required setup or still depends on unresolved restoration blockers
- **THEN** the execution record SHALL state the blocker explicitly instead of marking the validation complete

### Requirement: Restoration reporting SHALL make degraded features explicit
The restoration record SHALL distinguish between supported baseline flows, guarded unsupported flows, and paths intentionally deferred because they rely on missing published-artifact code.

#### Scenario: A feature is intentionally guarded
- **WHEN** restoration work disables or guards a path that depends on missing internal modules
- **THEN** the change record SHALL note that the path is intentionally unsupported in the current restoration phase

#### Scenario: A donor implementation is adopted selectively
- **WHEN** code or files are imported from an external runnable fork to restore a path
- **THEN** the execution record SHALL describe the adopted area and the validation used to confirm it matches this repository's active restoration baseline
