## ADDED Requirements

### Requirement: Unresolved import inventory
The project SHALL maintain an explicit inventory of unresolved relative imports reported by the restoration launcher for the current repository state.

#### Scenario: Inventory is refreshed
- **WHEN** maintainers re-run the restoration launcher in diagnostic mode
- **THEN** the resulting unresolved relative imports MUST be captured as a current inventory rather than treated only as a single aggregate count

### Requirement: Treatment classification
Each unresolved relative import in the maintained inventory SHALL be assigned one of four treatment classes: `restore`, `shim`, `guard`, or `defer`.

#### Scenario: Import is classified
- **WHEN** an unresolved relative import is reviewed for follow-up work
- **THEN** the project MUST record exactly one treatment class and the rationale for that class before implementation proceeds

### Requirement: Grouped follow-up planning
The project SHALL plan unresolved-import follow-up work by grouped treatment bucket instead of file-by-file cleanup order.

#### Scenario: Follow-up tasks are created
- **WHEN** maintainers prepare implementation work from the unresolved-import inventory
- **THEN** tasks MUST be grouped by treatment bucket and active-path relevance rather than by raw import listing order

### Requirement: Forwarding criteria are explicit
The project SHALL define the conditions under which `src/dev-entry.ts` is allowed to forward into the real CLI entrypoint.

#### Scenario: Remaining unresolved imports are non-blocking
- **WHEN** unresolved relative imports remain but all active-path blockers have been resolved, guarded, or explicitly deferred out of scope for the current runtime gate
- **THEN** the project MUST evaluate forwarding based on the documented criteria rather than assuming the remaining count alone blocks activation