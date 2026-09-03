# Project review

## Overall assessment

This is a strong, appropriately scoped proof-of-concept.
The API, fairness core, catalog, static frontend, and
documentation are separated cleanly, with no unnecessary frontend build step.

As of 2026-09-03, the baseline checks are healthy:

- 9 tests pass.
- Ruff passes.
- `ty` reports no type errors.

The demo is ready to demonstrate the core loop. It is not yet a production
case-opening platform, which is consistent with the stated scope.

## Important limitations

### Fairness and nonce semantics

The roll algorithm is deterministic and independently verifiable. However,
the nonce is supplied by the client and incremented in browser memory. This
supports a determinism demo, but it is not a server-enforced per-session
nonce. A production implementation needs server-side state, replay handling,
seed rotation, and an auditable record of each roll.

The default server seed is intentionally insecure for the demo and must be
replaced through environment configuration before any shared deployment.

### Product scope

There is no real money, payment provider, Steam login, inventory, withdrawal,
live pricing, bot integration, or balance accounting. These are explicitly
out of scope and should remain so until the legal and business direction is
decided.

### Legal and trust

The Ukraine notes are useful risk flags and decision prompts, but are not a
legal opinion. Obtain current specialist advice before adding deposits,
cash-out, crypto, or gambling-like mechanics.

## Follow-up priorities

1. For the next demo: show drop percentages, keep the error states clear, and
   explain the client-controlled nonce limitation when presenting fairness.
2. Before a real-money pilot: implement server-side sessions/nonces, seed
   rotation and reveal policy, immutable roll records, rate limits, and
   operational secrets management.
3. Before product investment: resolve the legal model, inventory funding,
   payment/cash-out path, Steam trade constraints, and user acquisition.

## Repository hygiene

The initial working tree contained the complete project as untracked files.
Create the initial commit if this repository is intended to be versioned.
