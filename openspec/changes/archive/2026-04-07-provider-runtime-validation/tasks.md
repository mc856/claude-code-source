## 1. Validation entrypoints

- [x] 1.1 Inventory the existing provider validation helpers, diagnostics paths, and deterministic CLI boundaries that can be reused for runtime validation.
- [x] 1.2 Add a repeatable provider validation entrypoint that exercises `claude`, `openai`, and `azure-openai` startup validation on the restored source runtime without requiring live provider requests.
- [x] 1.3 Add an npm script or equivalent documented command for running the provider runtime validation entrypoint.

## 2. Regression checks

- [x] 2.1 Add or extend automated tests for provider/model incompatibility and provider-specific configuration failures used by the validation matrix.
- [x] 2.2 Ensure validation output or tests explicitly capture the expected Claude `--bare` auth boundary versus a real runtime regression.
- [x] 2.3 Verify that diagnostics output includes the active provider, resolved model target, and credential-source or limitation context for each provider path.

## 3. Validation and closeout

- [x] 3.1 Run the new provider validation commands and existing restored-runtime regression checks together.
- [x] 3.2 Record the validation matrix and any intentionally unvalidated live-provider surfaces in the change notes before archive.