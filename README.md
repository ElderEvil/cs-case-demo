# CS Case Demo

Clickable demo: FastAPI serves its own static frontend (no Node build),
5 UAH-priced cases, deterministic provably-fair rolls. Fake money, no Steam,
no payments — a standalone loop demo before committing to bots + licence.

Background docs: `docs/market.md`, `docs/implementation.md`,
`docs/legal-ua.md`, `docs/demo-script.md`, and the current
[project review](docs/project-review.md).

## Run

```bash
uv sync --group dev
uv run uvicorn cs_case_demo.main:app --reload  # needs src on path: see below
```

Simpler (src layout):

```bash
uv sync --group dev
PYTHONPATH=src uv run uvicorn cs_case_demo.main:app --reload
```

Open <http://127.0.0.1:8000/> (landing) and
<http://127.0.0.1:8000/docs> (API).

## Test

```bash
PYTHONPATH=src uv run pytest
```

## Env

```bash
cp .env.example .env
```

`CSDEMO_DEMO_SERVER_SEED` overrides the insecure default seed.
`CSDEMO_DEBUG=1` for debug mode.

## Layout

```text
src/cs_case_demo/  fairness.py (fair core) · catalog.py (UAH tiers) ·
                   schemas.py (Pydantic boundary) · routers/ · main.py
static/            index.html + app.js + styles.css (no build step)
tests/             fairness unit + API tests
docs/              market / implementation / legal-ua / demo-script
```
