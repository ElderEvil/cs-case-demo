# Demo script (5 min)

1. Open `/` — 5 UAH cases, cheapest first. Point out visible odds per item.
2. Open Recruit twice with the same seed/nonce — same item (determinism).
3. Change the seed — different item. Explain: `HMAC(server, client:nonce)`.
4. Show `/docs` — `GET /api/cases`, `POST /api/open`, `/api/fair/*`.
5. Verify tab: paste revealed seed → `commitment_valid=true`.
6. State the fairness scope honestly: the nonce is client-supplied and kept
   in browser memory — this proves determinism, not server-enforced replay
   protection. A pilot needs server-side nonces, seed rotation, and immutable
   roll records (see `project-review.md`).
7. Ask the three questions: fake UI enough, or working Steam bots next?
   Cash-out vision (Steam-only vs real money)? Traffic source (streamers)?
