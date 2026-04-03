## ADDED Requirements

### Requirement: Debt reduction SHALL preserve the runnable baseline
Debt-reduction work SHALL preserve the runnable-source restoration baseline established by the prior restoration change.

#### Scenario: Validating a completed cluster pass
- **WHEN** a cluster implementation pass is completed
- **THEN** the project SHALL continue to pass `bun src/entrypoints/cli.tsx --version`, `bun src/entrypoints/cli.tsx --help`, `node cli.js --version`, and `npm run validate:restoration`

### Requirement: Cluster validation SHALL measure local improvement
Debt-reduction validation SHALL record localized maintainability or error-surface improvement for the cluster being changed rather than relying only on repository-wide TypeScript totals.

#### Scenario: Reporting cluster outcomes
- **WHEN** a debt-reduction pass is documented
- **THEN** the execution record SHALL identify the touched cluster, the chosen treatment, and the observed local validation or error reduction

### Requirement: Unrelated repository-wide debt SHALL remain deferred
Validation for this change SHALL NOT fail solely because unrelated repository-wide TypeScript debt remains outside the currently selected cluster.

#### Scenario: Global TypeScript output still contains unrelated errors
- **WHEN** cluster validation passes and the runnable baseline remains green
- **THEN** unrelated repository-wide errors outside the approved cluster SHALL be treated as deferred debt rather than as failure of the current cluster pass
