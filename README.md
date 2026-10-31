# CS Case Demo

Clickable demo: Bun + Elysia serve the static frontend from the same process
(no build step), 5 UAH-priced cases, deterministic provably-fair rolls. Fake
money, no Steam, no payments. A standalone loop demo before committing to bots
+ licence.

Background docs: `docs/market.md`, `docs/implementation.md`,
`docs/legal-ua.md`, `docs/demo-script.md`, and the current
[project review](docs/project-review.md).

## Stack

- Bun `1.4.4` runtime and test runner
- Elysia `1.4.30` for the HTTP API
- `@elysiajs/static` `1.4.10` for the frontend and `@elysiajs/swagger` `1.3.1`
  for `/docs`
- `bun:sqlite` for the roll audit trail
- TypeBox schemas for the request/response boundary
- Plain HTML, CSS, and JS under `static/`, with no bundler

## Run

```bash
bun install
bun run dev    # watch mode
```

Or without watch:

```bash
bun run start
```

Open <http://127.0.0.1:8000/> (landing) and
<http://127.0.0.1:8000/docs> (API docs).

## Test and quality

```bash
bun test        # 123 tests across 4 files
bun run check   # biome check . && tsc --noEmit
```

## Env

Bun loads `.env` automatically, so `cp .env.example .env` is a convenient
starting point. Every variable also works as a normal process environment
variable.

| Variable | Default | Notes |
| --- | --- | --- |
| `CSDEMO_DEMO_SERVER_SEED` | `demo-seed-change-me` | Insecure demo seed. Set a long random secret in production. |
| `CSDEMO_DEBUG` | unset (off) | `1`, `true`, `True`, or `yes` enable debug mode. |
| `CSDEMO_DATABASE_URL` | `sqlite:///./cs-case-demo.db` | Relative SQLite path. Absolute paths use four slashes, e.g. `sqlite:////data/cs-case-demo.db`. |

## Layout

```text
src/index.ts       Elysia app, /api routes, static plugin, validation errors
src/fairness.ts    provably-fair core: HMAC roll, commitment, weighted pick
src/catalog.ts     static UAH case tiers and item weights
src/schemas.ts     TypeBox request/response schemas
src/db.ts          bun:sqlite handle and roll_records persistence
src/config.ts      env parsing and SQLite URL handling
tests/             fairness, config, API, and parity tests
parity/            frozen oracle fixtures, provenance, and replay script
static/            index.html + app.js + styles.css (no build step)
docs/              market / implementation / legal-ua / demo-script / deploy
```
