## ADDED Requirements

### Requirement: Debt reduction SHALL be cluster-scoped
The system SHALL define debt-reduction work as a sequence of named, bounded clusters rather than as unrestricted repository-wide TypeScript cleanup.

#### Scenario: Starting a debt-reduction pass
- **WHEN** the team begins work under this change
- **THEN** the active work item SHALL identify a specific cluster and its primary treatment strategy before code changes proceed

### Requirement: Each cluster SHALL declare an allowed treatment
Each selected cluster SHALL be classified as a localized rewrite, compatibility-layer replacement, or bounded type-surface cleanup.

#### Scenario: Choosing a remediation strategy
- **WHEN** a cluster is selected for implementation
- **THEN** the implementation record SHALL state which of the three treatments applies and SHALL not mix strategies without an explicit follow-up decision

### Requirement: Donor infrastructure alignment SHALL precede source rewrites for dependency drift
When a debt cluster is primarily caused by missing dependencies, private/native package imports, or incomplete package installation, the implementation SHALL evaluate donor restoration infrastructure before rewriting source modules.

#### Scenario: Encountering telemetry or native package blockers
- **WHEN** the blocker can be explained by missing package metadata, missing private/native packages, or absent local shims
- **THEN** the implementation SHALL prefer package dependency alignment, `shims/*`, `vendor/*`, or launcher alignment before patching unrelated source files

### Requirement: Core runtime systems SHALL remain out of scope
This change SHALL NOT use debt-reduction work as justification to rewrite core runtime systems such as entrypoints, app-state roots, session storage, task framework, or provider/tool execution cores.

#### Scenario: Encountering debt in a core runtime file
- **WHEN** repository-wide monitoring surfaces a core runtime issue outside the approved cluster
- **THEN** that issue SHALL be recorded as deferred follow-up unless it blocks the runnable baseline directly
