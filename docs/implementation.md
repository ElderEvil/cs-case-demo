# Implementation plan (Bun + Elysia)

Timelines assume one AI-powered engineer. Proven reference: this repo
(API + fair core + static frontend + 123 tests + docs) was built in one session.

## Demo (this repo, 1–2 days solo, DONE)

Bun + Elysia serve the JSON API and the static frontend from one process.
`bun:sqlite` stores the roll audit trail. There is no build step, no ORM, and
no separate frontend deployment.

Module map (all under `src/`):

| Module | Responsibility |
| --- | --- |
| `src/index.ts` | Elysia app, `/api` routes, static plugin, Swagger at `/docs`, validation error mapping |
| `src/fairness.ts` | Provably-fair core: HMAC-SHA256 roll, `SHA256(server_seed)` commitment, weighted item pick |
| `src/catalog.ts` | Static UAH case tiers and item weights |
| `src/schemas.ts` | TypeBox request/response schemas for the HTTP boundary |
| `src/db.ts` | `bun:sqlite` handle, `roll_records` DDL, audit inserts |
| `src/config.ts` | Env parsing and `sqlite:///` URL to filesystem path resolution |

Runtime: Bun `1.4.4`, Elysia `1.4.30`, `@elysiajs/static` `1.4.10`,
`@elysiajs/swagger` `1.3.1`.

## Parity contract

The port must keep the observable wire behaviour of the pre-port baseline.

- Roll: the first 4 bytes of
  `HMAC-SHA256(key=server_seed, msg="${client_seed}:${nonce}")`, read
  big-endian, divided by `2^32`, giving a value in `[0, 1)`.
- Commitment: `SHA256(server_seed)` as lowercase hex.
- Oracle: `parity/fixtures.json` holds 45 hash vectors and 15 API vectors.
  `parity/README.md` documents provenance and the exact capture environment.
- Replay: `bun run parity/replay.ts <baseUrl>` for the demo seed, and
  `bun run parity/replay.ts <baseUrl> --structural` for production.
- The fixtures were captured from the pre-port FastAPI baseline at git tag
  `pre-elysia`; the runtime is Elysia.

## Demo+ (~1 wk solo)

Steam OpenID login + LiqPay/Monobank sandbox + live UAH pricing
(PriceEmpire trial). Still no real bots.

## MVP (2–4 wks, 1 engineer + designer on call)

- Real bots: `steampy` (`make_offer_with_url`, auto-confirm via identity
  secret); isolate a Node `steam-user + tradeoffer-manager` microservice only
  if Bun hits guard/rate limits.
- Seed float for bot inventory (~$1–5k rough) + <5m withdrawals from day one.
- Prices: PriceEmpire (paid, UAH, Buff163/Steam/DMarket); cache in Redis,
  reprice hourly.
- Payments: Monobank 1.3% (FOP, free PRRO) → LiqPay 1.5% (`neoliqpay`) →
  WayForPay 2% (`pywayforpay`). Crypto fallback: WhiteBIT / Binance Pay.
  Fondy skipped for UA entities (NBU licence revoked 2024).
- Modes: Battles + Upgrader + Daily free. Admin: internal admin panel.
  Live drops via Elysia WS + Redis pub/sub.
- Bottleneck is seed inventory + QA/trust, not code.

## V1 (+2–3 wks)

Contracts, user cases, referrals, antifraud/limits, SOMS-ready logging if the
licence path is chosen.

## What doesn't compress

Legal/licence clock (PlayCity, 30M UAH capital), bot seed capital, design
polish, streamer distribution, Steam trade holds. See `legal-ua.md`.
