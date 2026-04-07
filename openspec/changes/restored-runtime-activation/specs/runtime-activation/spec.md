## ADDED Requirements

### Requirement: Direct source runtime activation gate
The project SHALL maintain an explicit direct source runtime activation gate that is separate from both the completed restoration baseline and repository-wide TypeScript monitoring.

#### Scenario: Activation gate is evaluated
- **WHEN** maintainers assess whether the restored source tree is operational beyond startup-only checks
- **THEN** they MUST use direct source validation commands that include a bounded print-mode runtime flow rather than relying only on `bun run dev` or full-repository `tsc`

### Requirement: Scanner launcher role is explicit
The project SHALL document when `src/dev-entry.ts` acts as a restoration scanner and SHALL NOT treat scanner early exit as proof that the direct source runtime itself has failed.

#### Scenario: Scanner blocks forwarding
- **WHEN** `src/dev-entry.ts` detects unresolved relative imports that still violate the current forwarding criteria
- **THEN** the launcher MUST report scanner-mode diagnostics and exit without being interpreted as the canonical direct runtime validation result

### Requirement: Direct print path blocker isolation
The project SHALL reduce the direct source `--bare -p` path to a narrow actionable blocker or a successful completion result before declaring runtime activation complete.

#### Scenario: Print path stalls
- **WHEN** the direct source print path does not complete within the bounded validation window
- **THEN** the project MUST record the furthest confirmed startup stage and treat the next unresolved stage as the active blocker for this change