## 1. Live smoke scaffolding

- [x] 1.1 Add testable helper logic for selecting live smoke providers and computing configuration-based skip reasons.
- [x] 1.2 Add an opt-in live provider smoke script that runs restored-runtime `-p` checks for selected providers and reports pass, fail, or skip per provider.
- [x] 1.3 Add an npm script or equivalent documented command for the live smoke validation entrypoint.

## 2. Verification coverage

- [x] 2.1 Add automated tests for live smoke provider selection and skip logic.
- [x] 2.2 Verify that the live smoke command exits successfully when opt-in is not enabled.
- [x] 2.3 Verify that missing-config providers are reported as skips instead of hard failures when no live attempt is made.

## 3. Closeout

- [x] 3.1 Record the live smoke command contract and its intentionally environment-dependent limits in the implementation notes.
- [x] 3.2 Confirm the change is apply-complete and ready for archive without changing the default deterministic validation gate.