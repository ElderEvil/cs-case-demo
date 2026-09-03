# Implementation plan (Python-first, AI-powered engineer)

Timelines assume one AI-powered engineer. Proven reference: this repo
(API + fair core + static frontend + 9 tests + docs) was built in one session.

## Demo (this repo, 1–2 days solo — DONE)

FastAPI + StaticFiles (no Node build) + SQLite-ready layout.
`src/cs_case_demo/fairness.py` is the provably-fair core,
`catalog.py` the static UAH tiers, `routers/` the JSON API,
`static/` the clickable landing.

## Demo+ (~1 wk solo)

Steam OpenID login + LiqPay/Monobank sandbox + live UAH pricing
(PriceEmpire trial). Still no real bots.

## MVP (2–4 wks, 1 engineer + designer on call)

- Real bots: `steampy` (`make_offer_with_url`, auto-confirm via identity
  secret); isolate Node `steam-user + tradeoffer-manager` microservice only
  if Python hits guard/rate limits.
- Seed float for bot inventory (~$1–5k rough) + <5m withdrawals from day one.
- Prices: PriceEmpire (paid, UAH, Buff163/Steam/DMarket); cache in Redis,
  reprice hourly.
- Payments: Monobank 1.3% (FOP, free PRRO) → LiqPay 1.5% (`neoliqpay`) →
  WayForPay 2% (`pywayforpay`). Crypto fallback: WhiteBIT / Binance Pay.
  Fondy skipped for UA entities (NBU licence revoked 2024).
- Modes: Battles + Upgrader + Daily free. Admin: SQLAdmin. Live drops via
  FastAPI WS + Redis pub/sub.
- Bottleneck is seed inventory + QA/trust, not code.

## V1 (+2–3 wks)

Contracts, user cases, referrals, antifraud/limits, SOMS-ready logging if the
licence path is chosen.

## What doesn't compress

Legal/licence clock (PlayCity, 30M UAH capital), bot seed capital, design
polish, streamer distribution, Steam trade holds. See `legal-ua.md`.

