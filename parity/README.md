# Parity fixtures

`fixtures.json` freezes the observable behaviour of the original FastAPI app so
the Elysia/Bun port can be replayed against the same oracle. It has exactly two
top-level keys:

- `hash_vectors` — 45 rows: 3 server seeds × 3 client seeds × 5 nonces.
  Each row is `{server_seed, client_seed, nonce, roll, commitment}`.
- `api_vectors` — 15 rows: `{name, request: {method, path, body?}, response: {status, body}}`.
  Every status code is recorded, including the 404 and 422 error responses, and
  response bodies are stored exactly as the app emitted them (no normalisation).

## Provenance

Captured from the FastAPI app at git tag `pre-elysia`. The runtime observed while
capturing was:

- Python `3.13.13`
- FastAPI `0.141.1`

The app was started unmodified, exactly as:

```bash
PYTHONPATH=src CSDEMO_DEMO_SERVER_SEED=demo-seed-change-me CSDEMO_DATABASE_URL=sqlite:////tmp/parity-capture.db uv run uvicorn cs_case_demo.main:app --host 127.0.0.1 --port 8001
```

`api_vectors` were then captured with real HTTP requests to `http://127.0.0.1:8001`
in the documented order. `hash_vectors` were computed by importing the app's own
fairness functions (`cs_case_demo.fairness.roll_float` and
`cs_case_demo.fairness.hash_server_seed`) with `PYTHONPATH=src`; no roll or
commitment value was hand-computed, rounded, or reformatted.

## Environment contract

- `PYTHONPATH=src` — makes `cs_case_demo` importable without installation.
- `CSDEMO_DEMO_SERVER_SEED=demo-seed-change-me` — pins the demo server seed used
  by `/api/open`, `/api/fair/commitment`, and `/api/fair/verify`.
- `CSDEMO_DATABASE_URL=sqlite:////tmp/parity-capture.db` — isolated throwaway
  SQLite database; it is never committed.

## Hash vector derivation

```python
from cs_case_demo.fairness import RollInput, roll_float, hash_server_seed
roll = roll_float(RollInput("demo-seed-change-me", "demo", 0)); commitment = hash_server_seed("demo-seed-change-me")
```

One server seed in this set is a fresh 64-hex-character value from
`secrets.token_hex(32)`, captured once and frozen with the rest of the vectors.

## Reproduction

Re-deriving these fixtures requires checking out tag `pre-elysia`, starting the
FastAPI app with the command and environment above, and re-running the same
capture (one random server seed will differ per run, so byte-for-byte
reproduction of that row is only possible from the committed file).

## Replay

```bash
bun run parity/replay.ts http://127.0.0.1:8000
bun run parity/replay.ts https://cs-case-demo.evillab.tech --structural
```

Production uses `--structural` because the real server seed keeps hash equality
unprovable, so the operator verifies response structure and item membership
instead of exact hash values.
