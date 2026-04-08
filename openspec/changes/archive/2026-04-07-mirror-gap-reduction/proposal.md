## Why

The first restoration phase has already reactivated the real source runtime for normal launcher usage, but the repository still contains a mixed set of restore placeholders, compatibility shims, guarded internal surfaces, and deferred asset gaps. A second phase is needed to reduce those remaining mirror gaps without reopening the solved runtime-activation problem or regressing the now-working source path.

## What Changes

- Define a post-activation reduction phase for remaining mirror gaps that are no longer blocking the minimum runtime gate.
- Require all remaining gaps to stay classified as `restore`, `shim`, `guard`, or `defer`, with work planned and executed by bucket rather than by raw missing-import count.
- Preserve the validated runtime boundary while tightening thin placeholders that still affect active non-bare flows.
- Record which guarded or deferred surfaces are intentionally unsupported in the restored mirror so future work does not re-investigate them as runtime blockers.

## Capabilities

### New Capabilities
- `mirror-gap-management`: Defines how post-activation mirror gaps are classified, reduced, validated, and documented after the minimum runtime gate is already working.

### Modified Capabilities

## Impact

- Affects `openspec/changes/restored-runtime-activation/` follow-up planning and the new second-phase execution record.
- Affects `src/`, `vendor/`, and `shims/` files that still rely on thin restore placeholders, compatibility shims, or intentionally degraded internal guards.
- Affects validation expectations for `src/dev-entry.ts`, especially the distinction between normal launcher success and intentionally OAuth-disabled `--bare` behavior.