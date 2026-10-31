# port-to-elysia - Work Plan

## TL;DR (For humans)

**Who this is for and what changes for them:** Anyone you show the demo to keeps seeing exactly the same case-opening page and the same verifiable rolls — the prototype just runs on a smaller, faster runtime instead of a Python web stack.

**What you'll get:** The demo rebuilt in Elysia/Bun with frozen proof that it behaves identically, one container that replaces the old one, updated run/deploy docs, and a one-command way back if anything looks wrong.

**Why this approach:** The current behaviour is captured as a committed fixture file *before* anything is replaced, so "identical" is measured rather than assumed; the old Python code is removed only after the new container passes that replay.

**What it will NOT do:** It does not add features, change the design or the odds, keep a second runtime around, or touch anything else hosted on the server.

**Effort:** Large
**Risk:** Medium - it is a live deployment, and float/error-body parity is the kind of difference that fails silently; both are gated by fixtures.
**Decisions to sanity-check:** Python code is deleted rather than kept side by side; the rollout strategy becomes `Recreate` (no two writers on one SQLite file); WAL stays off.

Your next move: hand this to an execution session (e.g. `$ulw-execute`). Full execution detail follows below.

---

> TL;DR (machine): Large / Medium — 14 todos, 5 waves: freeze Python parity fixtures, port fairness→db→http to Elysia/Bun behind fixture replay, containerize, delete the Python runtime, redeploy k3s with one changed manifest line, keep `static/` byte-identical.

## Scope

### Affected user and ideal state

**Affected user:** The demo viewer (prospect or partner being shown the prototype) uses the landing page and the "Verify a roll" dialog; the operator (`elder`) deploys and inspects the SQLite roll history; a machine consumer replays `/api/fair/verify` to confirm a published commitment.

| Row | Statement | Reason |
| --- | --- | --- |
| IS-1 | The landing page renders and behaves exactly as today; every file under `static/` is byte-identical. | Any visual or interaction change turns a port into a redesign and invalidates the demo script. |
| IS-2 | Every endpoint returns the same status code and the same JSON values as the FastAPI build for the same seed and inputs, including the 404 message and roll floats. | Published commitments must remain verifiable and independent re-derivations must produce the same number. |
| IS-3 | `GET /docs` still serves interactive API documentation at the same path. | The footer links there and the API surface is part of the pitch. |
| IS-4 | Roll history keeps appending to the same SQLite file and table, with the same columns and timestamp text, no migration and no data loss. | The PVC holds real demo history and the operator inspects it with `sqlite3`. |
| IS-5 | The container starts under the existing Deployment (port 8000, `/api/health` probes, 128Mi request / 256Mi limit) with no manifest churn beyond the rollout strategy. | The deploy path is proven; unnecessary churn creates incidents. |
| IS-6 | `bun test` and `biome check` cover at least the behaviour `pytest` and `ruff` covered. | A port that weakens the test suite is a regression dressed as progress. |
| IS-7 | Rollback is `./scripts/deploy-hetzner.sh <previous-tag>` with the old image still present in containerd. | A live deployment needs a recovery path measured in seconds. |
| GAP-1 | Static files are served today by FastAPI's `StaticFiles` mount at `/`; the runtime is being replaced. | Static serving is the highest-risk silent regression in a runtime swap. |
| GAP-2 | The roll math and error bodies exist only as Python code; nothing pins them across a rewrite. | Floats and JSON shaping drift silently; without frozen fixtures parity cannot be proven. |
| GAP-3 | `/docs` is automatic in FastAPI and absent in plain Elysia. | The footer link breaks unless Swagger is plugged in. |
| GAP-4 | `roll_records` DDL and the SQLAlchemy datetime text format are implicit in the ORM. | A fresh table with a different timestamp format splits history into two shapes. |
| GAP-5 | Image, memory and probe limits were never validated against a Bun process. | Unvalidated limits surface as an OOMKill or a failed readiness probe on rollout. |
| GAP-6 | Confidence comes from 10 `pytest` tests and `ruff`; deleting Python deletes them. | The port would ship unguarded. |
| GAP-7 | The deploy layer (`Dockerfile`, `k8s/`, `scripts/`, `docs/deploy-hetzner.md`) is uncommitted, so there is no baseline to roll back to. | Rollback is impossible until that state is committed and tagged. |

### Must have

- `parity/fixtures.json` committed, captured from the **unmodified** Python app, containing ≥40 hash vectors and ≥14 API vectors (including the 404 body and a validation-error body).
- `src/fairness.ts` producing bit-identical rolls and commitments for every hash vector.
- `src/index.ts` serving `/api/health`, `/api/cases`, `/api/cases/:id`, `POST /api/open`, `/api/fair/commitment`, `POST /api/fair/verify`, `/docs`, and the `static/` tree at `/`.
- `src/db.ts` writing to the existing table with SQLAlchemy-compatible `created_at` text.
- `tests/*.test.ts` covering every assertion the Python suite made, plus fixture replay.
- A Bun image serving on port 8000 with the same env contract.
- Live verification on `https://cs-case-demo.evillab.tech` with the pre-existing PVC data intact.

### Must NOT have (guardrails, anti-slop, scope boundaries)

- No edits to `static/index.html`, `static/app.js`, `static/styles.css`, `static/assets/*` — `git diff --stat` for `static/` must be empty at every commit.
- No change to case ids, names, prices, weights, or the fairness formula (first 4 bytes of HMAC-SHA256, big-endian, over 2^32; commitment = `sha256(server_seed)` hex).
- No new endpoints, auth, sessions, CORS, rate limiting, telemetry, error tracking, or logging framework.
- No schema change, migration, ORM, WAL mode, or rewriting existing rows.
- No dependencies beyond `elysia`, `@elysiajs/static`, `@elysiajs/swagger`, and dev-only `@types/bun` + existing `@biomejs/biome`.
- No bundler, no committed build output, no container user change, no port change.
- No changes to namespace, service, ingress, TLS, PVC, secret, or resource requests/limits.
- No "while I'm here" improvements to the frontend, the catalog, or the fairness algorithm.
- No Python files left in the runtime path and no second parallel deployment.

## Verification strategy

> Zero human intervention - all verification is agent-executed.
- Test decision: **TDD for the fairness core** (fixtures written first, tests red, then implementation), **tests-after for the HTTP layer**, both on `bun test`. Static/format gates on `biome check`.
- Parity contract: values compared with `===` after `JSON.parse`; status codes and string fields compared exactly; float *formatting* is explicitly not part of the contract (Python emits `1e-05` where JS emits `0.00001`).
- Evidence: `.omo/evidence/task-<N>-port-to-elysia.<ext>` (outside ulw-loop; attempt dir is `.omo/evidence/`).

## Execution strategy

### Parallel execution waves

**Wave 1 — baseline and oracle.** Todo 1 is serial and first (a rollback point must exist before anything changes). Todos 2 and 3 then run in parallel: the Bun toolchain scaffold does not depend on fixture capture, and capture needs only the Python app.

**Wave 2 — pure core.** Todos 4-7 in parallel after their inputs land: 4 needs 3 (fixtures), 5-7 need 2 (scaffold). Each owns disjoint files.

**Wave 3 — server and tests.** Todo 8 (HTTP) needs 4-7; todo 9 (test port + replay) needs 8 and 3.

**Wave 4 — package, prove, delete, document.** 10 (Dockerfile) after 9; 11 (container parity + measurement) after 10; 12 (delete Python) after 11 — deletion is last-resort-ordered so the oracle is never lost early; 13 (docs) after 12.

**Wave 5 — ship.** 14 (deploy + live verify + rollback drill) after 11, 12, 13.

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | - | 2, 3 | - |
| 2 | 1 | 4, 5, 6, 7, 8, 10 | 3 |
| 3 | 1 | 4, 9, 11 | 2 |
| 4 | 2, 3 | 8, 9 | 5, 6, 7 |
| 5 | 2 | 8 | 4, 6, 7 |
| 6 | 2 | 8, 11 | 4, 5, 7 |
| 7 | 2 | 8 | 4, 5, 6 |
| 8 | 4, 5, 6, 7 | 9, 10 | - |
| 9 | 3, 8 | 10, 12 | - |
| 10 | 9 | 11 | 13 (doc draft only) |
| 11 | 3, 6, 10 | 12, 14 | 13 (doc draft only) |
| 12 | 9, 11 | 13, 14 | - |
| 13 | 10, 11, 12 | 14 | - |
| 14 | 11, 12, 13 | F1-F4 | - |

## Todos

> Implementation + Test = ONE todo. Never separate.

- [ ] 1. Commit the untracked deploy layer, tag `pre-elysia`, and branch `port/elysia`
  What to do / Must NOT do: On `master` at `1b22470`, stage exactly `.dockerignore`, `Dockerfile`, `k8s/`, `scripts/`, `docs/deploy-hetzner.md`, `docs/backend-engineering-en-ru.md`, and this plan file `.omo/plans/port-to-elysia.md`. Add `.omo/drafts/` and `.omo/evidence/` to `.gitignore` in the same commit. Commit, then `git tag pre-elysia`, then `git switch -c port/elysia`. Must NOT: push, amend, rebase, force anything, stage `cs-case-demo.db` (gitignored), stage `.omo/run-continuation/`, or modify any file content other than `.gitignore`.
  Closes: GAP-7
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2, 3
  References (executor has NO interview context - be exhaustive): `git status` shows exactly 7 untracked entries; `git log --oneline -1` = `1b22470 Build polished case-opening demo`; `.gitignore` currently ends with `cs-case-demo.db`; `scripts/deploy-hetzner.sh:6` derives the default tag from `git rev-parse --short HEAD`.
  Acceptance criteria (agent-executable): `git tag --list pre-elysia` prints `pre-elysia`; `git branch --show-current` prints `port/elysia`; `git status --porcelain` prints nothing.
  QA scenarios (name the exact tool + invocation): happy - `bash -c 'git status --porcelain && git tag --list pre-elysia'` is empty + tagged; failure - confirm `git ls-files | grep -c "cs-case-demo.db"` returns `0`. Evidence `.omo/evidence/task-1-port-to-elysia.txt`
  Commit: Y | `chore(repo): commit deploy layer and freeze pre-port baseline`
  Recommended task executor category: `quick`

- [ ] 2. Install Bun and scaffold the TypeScript project without touching runtime behaviour
  What to do / Must NOT do: Install Bun user-locally (`curl -fsSL https://bun.sh/install | bash`, binary at `~/.bun/bin/bun`); never `sudo`, never layer an rpm-ostree package on this immutable host. Add deps with `bun add elysia @elysiajs/static @elysiajs/swagger` and `bun add -d @types/bun` so `bun.lock` is created. Write `tsconfig.json` with `{"compilerOptions":{"target":"ESNext","module":"Preserve","moduleResolution":"bundler","strict":true,"noUncheckedIndexedAccess":true,"noEmit":true,"allowImportingTsExtensions":true,"verbatimModuleSyntax":true,"skipLibCheck":true,"types":["bun"]}}`. Update `package.json`: keep `"private": true`, add `"type": "module"`, scripts `dev: "bun --watch src/index.ts"`, `start: "bun run src/index.ts"`, `test: "bun test"`, `lint: "biome check ."`, `format: "biome format --write ."`, `check: "biome check . && bunx tsc --noEmit"`. Extend `biome.json` `files.includes` to `["static/**","src/**","tests/**","parity/**"]` and keep the existing formatter settings. Must NOT: run `bun init` interactively, add any dependency outside the four named, create files under `src/` beyond an empty `src/` directory, touch `static/`, or delete any Python file.
  Closes: GAP-6
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 4, 5, 6, 7, 8, 10
  References: `package.json:1-9` currently has only the biome devDependency and two format scripts; `biome.json:1-9` has `files.includes: ["static/**"]`; `docs/deploy-hetzner.md:5` shows the host is `hetzner` k3s and the local box is Bazzite (immutable).
  Acceptance criteria (agent-executable): `~/.bun/bin/bun --version` prints a `1.` version; `bun install --frozen-lockfile` exits 0; `bun pm ls` lists `elysia`; `bunx biome check .` exits 0.
  QA scenarios: happy - `bash -c 'bun install --frozen-lockfile && bunx biome check .'` exits 0; failure - `bash -c '! grep -q "fastify\|hono\|express" package.json'` must hold (no accidental framework). Evidence `.omo/evidence/task-2-port-to-elysia.txt`
  Commit: Y | `chore(build): add Bun toolchain and project scaffold`
  Recommended task executor category: `quick`

- [ ] 3. Freeze the current Python behaviour as committed parity fixtures
  What to do / Must NOT do: Start the **unmodified** app on port 8001 with `PYTHONPATH=src CSDEMO_DEMO_SERVER_SEED=demo-seed-change-me CSDEMO_DATABASE_URL=sqlite:////tmp/parity-capture.db uv run uvicorn cs_case_demo.main:app --host 127.0.0.1 --port 8001`. Generate `parity/fixtures.json` with two collections. `hash_vectors`: for `server_seed` in `["s","demo-seed-change-me","<64-hex from secrets.token_hex(32)>"]` × `client_seed` in `["demo","c","тест"]` × `nonce` in `[0,1,7,42,999]`, record `{server_seed, client_seed, nonce, roll, commitment}` computed with the app's own `fairness.roll_float` and `fairness.hash_server_seed` (45 rows). `api_vectors`: `GET /api/health`; `GET /api/cases`; `GET /api/cases/recruit`; `GET /api/cases/zeus`; `GET /api/cases/nope`; `GET /api/fair/commitment`; `POST /api/open` once per case id `recruit,vanguard,anime,zeus,knife` with `{client_seed:"demo", nonce:<index>}`; `POST /api/open` with `{"case_id":"nope"}`; `POST /api/open` with `{"case_id":"recruit","client_seed":""}` (validation error); `POST /api/fair/verify` with the valid seed/client/nonce/commitment; `POST /api/fair/verify` with `commitment` set to 64 zeros. Each row is `{name, request:{method,path,body?}, response:{status, body}}`. Write `parity/README.md` explaining that fixtures were produced from FastAPI 0.116 / Python 3.13 at tag `pre-elysia`, with the exact commands and the two-line Python snippet, and that re-deriving them requires checking out that tag. Must NOT: edit the app, point `CSDEMO_DATABASE_URL` at `./cs-case-demo.db` or `/data`, commit `/tmp/parity-capture.db`, or hand-write rolls instead of reading them from the app.
  Closes: GAP-2
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 4, 9, 11
  References: `src/cs_case_demo/fairness.py:29-57` (commitment + roll), `src/cs_case_demo/routers/cases.py:13-31` (open + 404 shape), `.env.example:1-3` (env names), `pyproject.toml:6-10` (FastAPI 0.116+, Pydantic v2).
  Acceptance criteria (agent-executable): `bun -e 'const f=JSON.parse(await Bun.file("parity/fixtures.json").text()); if(f.hash_vectors.length<40||f.api_vectors.length<14) throw 1; const n=f.api_vectors.find(v=>v.name.includes("unknown")); if(n.response.body.detail!=="Unknown case: nope") throw 2; console.log("ok")'` prints `ok`; `git ls-files --error-unmatch /tmp/parity-capture.db` fails.
  QA scenarios: happy - the acceptance command exits 0; failure - confirm the validation-error vector has `response.status === 422` and an array `detail` (assert in the same command, throw 3 otherwise). Evidence `.omo/evidence/task-3-port-to-elysia.json`
  Commit: Y | `test(parity): freeze FastAPI responses as porting fixtures`
  Recommended task executor category: `unspecified-high`

- [ ] 4. Port the provably-fair core to `src/fairness.ts` against the hash vectors
  What to do / Must NOT do: Implement `generateServerSeed(): string` (`randomBytes(32).toString("hex")`), `hashServerSeed(seed: string): string` (`createHash("sha256").update(seed,"utf8").digest("hex")`), `rollFloat(input: {serverSeed: string; clientSeed: string; nonce: number}): number` (`createHmac("sha256", input.serverSeed).update(`${input.clientSeed}:${input.nonce}`,"utf8").digest().readUInt32BE(0) / 4294967296`), `pickWeightedIndex(roll: number, weights: readonly number[]): number` (accumulate, strict `target < cumulative`, else last index), `verifyRoll(input, commitment): boolean` (string equality). Write `tests/fairness.test.ts` first, parameterized over every `hash_vectors` row asserting `rollFloat(...) === row.roll` and `hashServerSeed(...) === row.commitment`, then port the four original unit assertions (determinism, `0 <= roll < 1` over 50 nonces, commitment roundtrip with a `"0".repeat(64)` negative, weighted bounds `0.0 -> 0` and `0.999 -> 3` for weights `(60,25,10,5)`). Must NOT: use `Bun.CryptoHasher`, `Math.random`, `toFixed`, epsilon comparisons, or any rounding; must not reorder the HMAC message parts; must not use `readUInt32BE` on a different byte offset.
  Closes: GAP-2
  Parallelization: Wave 2 | Blocked by: 2, 3 | Blocks: 8, 9
  References: `src/cs_case_demo/fairness.py:1-57` (whole file is the contract), `tests/test_fairness.py:1-34` (the four ported unit assertions), `parity/fixtures.json` `hash_vectors`.
  Acceptance criteria (agent-executable): `bun test tests/fairness.test.ts` passes with 0 failures and the parameterized count reported ≥ 49 cases.
  QA scenarios: happy - `bun test tests/fairness.test.ts`; failure - temporarily assert `pickWeightedIndex(0.999,(60,25,10,5)) === 3` and `pickWeightedIndex(0.0,(60,25,10,5)) === 0` both present. Evidence `.omo/evidence/task-4-port-to-elysia.txt`
  Commit: Y | `feat(fairness): port provably-fair core to TypeScript`
  Recommended task executor category: `deep-low`

- [ ] 5. Port the catalog and boundary schemas to `src/catalog.ts` and `src/schemas.ts`
  What to do / Must NOT do: Copy the five cases verbatim, cheapest first, preserving ids, names, `price_uah` and weights: `recruit/Recruit/24` with `usp-s`(18,60), `glock-ca`(45,25), `ak-wg`(120,10), `m4a4-neo`(900,5); `vanguard/Vanguard Prime/33` with `famas`(25,55), `mp7`(60,28), `deagle`(260,12), `ak-ruby`(1400,5); `anime/Anime: Tanjiro/81` with `p250`(70,55), `m4a1-s`(200,28), `awp-asi`(900,12), `knife-t`(22000,5); `zeus/Zeus/297` with `cz`(220,55), `p90`(550,28), `m4a4-howl`(2400,12), `gloves-s`(45000,5); `knife/Knife Hunt/4413` with `kukri`(3200,60), `bowie`(8000,25), `m9`(24000,10), `bfly`(90000,5). Item names must include the exact `★` prefixes and `(FT)`/`(BS)`/`(MW)`/`(FN)` suffixes as in the Python source. Export `listCases()`, `getCase(id)`. In `src/schemas.ts` define TypeBox models: `OpenRequest` = `{case_id: string(minLength 1), client_seed: string(minLength 1, maxLength 64) default "demo", nonce: integer(minimum 0) default 0}`, `VerifyRequest` = `{server_seed: string(minLength 1), client_seed: string(minLength 1, maxLength 64), nonce: integer(minimum 0), commitment: string(minLength 64, maxLength 64)}`, plus `CaseItemOut`, `CaseOut`, `OpenResult`, `VerifyResult`, `HealthOut`, `CommitmentOut`. Must NOT: set `additionalProperties: false` anywhere (Pydantic ignored extra fields), rename any id, reorder cases, or change a weight/price.
  Closes: GAP-2
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: 8
  References: `src/cs_case_demo/catalog.py:22-96` (authoritative case data), `src/cs_case_demo/schemas.py:1-91` (field bounds and defaults).
  Acceptance criteria (agent-executable): `bun -e 'import {listCases} from "./src/catalog.ts"; const c=listCases(); const ids=c.map(x=>x.id).join(","); if(ids!=="recruit,vanguard,anime,zeus,knife") throw 1; if(JSON.stringify(c.map(x=>x.priceUah))!=="[24,33,81,297,4413]") throw 2; if(c[2].items[3].name!=="★ Talon Knife | Tiger Tooth (FT)") throw 3; console.log("ok")'` prints `ok`.
  QA scenarios: happy - the acceptance command; failure - assert `c[4].items.reduce((a,i)=>a+i.weight,0) === 100` and that every case's weights sum to 100. Evidence `.omo/evidence/task-5-port-to-elysia.txt`
  Commit: Y | `feat(catalog): port case catalog and TypeBox schemas`
  Recommended task executor category: `quick`

- [ ] 6. Port roll persistence to `src/db.ts` on `bun:sqlite` with the existing table contract
  What to do / Must NOT do: Open the database from config at startup, run `PRAGMA busy_timeout = 5000`, then `CREATE TABLE IF NOT EXISTS roll_records (id INTEGER NOT NULL, created_at DATETIME NOT NULL, case_id VARCHAR(64) NOT NULL, item_id VARCHAR(128) NOT NULL, client_seed VARCHAR(64) NOT NULL, nonce INTEGER NOT NULL, roll FLOAT NOT NULL, server_hash VARCHAR(64) NOT NULL, PRIMARY KEY (id))` and `CREATE INDEX IF NOT EXISTS ix_roll_records_case_id ON roll_records (case_id)`. Implement `formatSqliteDatetime(d: Date): string` returning `YYYY-MM-DD HH:MM:SS.ffffff` in UTC (derive from `toISOString()`, replace `T` with a space, drop `Z`, pad the millisecond part to six digits with zeros). Implement `recordRoll({caseId, itemId, clientSeed, nonce, roll, serverHash})` inserting `created_at, case_id, item_id, client_seed, nonce, roll, server_hash`. Fail fast with a clear message if the parent directory does not exist. Must NOT: enable WAL, add an ORM, alter/drop the table, add columns or defaults to the DDL, delete rows, or write a non-UTC timestamp.
  Closes: GAP-4
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: 8, 11
  References: `src/cs_case_demo/database.py:19-63` (model + insert), live DDL captured from `cs-case-demo.db` (exact text quoted above), `k8s/deployment.yaml:36-40` (`sqlite:////data/cs-case-demo.db`, PVC at `/data`).
  Acceptance criteria (agent-executable): `bun -e 'import {Database} from "bun:sqlite"'` style check plus: run a temp-DB script that records one row, then `bun -e 'const {Database}=await import("bun:sqlite"); const db=new Database("/tmp/dbcheck.db"); const r=db.query("select created_at from roll_records").get(); if(!/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{6}$/.test(r.created_at)) throw 1; console.log("ok")'` prints `ok`.
  QA scenarios: happy - insert one row and assert regex + `typeof created_at === "string"`; failure - open the same file twice sequentially and confirm the second open does not error (idempotent DDL) and `SELECT count(*)` is unchanged. Evidence `.omo/evidence/task-6-port-to-elysia.txt`
  Commit: Y | `feat(db): port roll persistence to bun:sqlite`
  Recommended task executor category: `unspecified-low`

- [ ] 7. Port runtime configuration to `src/config.ts`
  What to do / Must NOT do: Expose `getConfig()` returning `{demoServerSeed, debug, databaseUrl, databasePath}`. Read `CSDEMO_DEMO_SERVER_SEED` (default `demo-seed-change-me`), `CSDEMO_DEBUG` (accept `"1"/"true"/"True"/"yes"` as true, everything else false; default false), `CSDEMO_DATABASE_URL` (default `sqlite:///./cs-case-demo.db`). Implement `parseDatabasePath(url: string): string`: strip the `sqlite:///` prefix so `sqlite:///./cs-case-demo.db` → `./cs-case-demo.db` and `sqlite:////data/cs-case-demo.db` → `/data/cs-case-demo.db`; throw on any URL not starting with `sqlite:///`. Rely on Bun's automatic `.env` loading for local parity with `pydantic-settings`. Must NOT: support postgres/mysql, invent a `CSDEMO_` prefix parsing library, read process env at call sites outside this module, or change any env name or default.
  Closes: GAP-4
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: 8
  References: `src/cs_case_demo/config.py:13-18` (names + defaults), `.env.example:1-3`, `k8s/deployment.yaml:30-40` (secret-sourced seed, absolute DB URL).
  Acceptance criteria (agent-executable): `bun test tests/config.test.ts` passes, asserting `parseDatabasePath("sqlite:///./cs-case-demo.db") === "./cs-case-demo.db"`, `parseDatabasePath("sqlite:////data/cs-case-demo.db") === "/data/cs-case-demo.db"`, and that a `postgres://` URL throws.
  QA scenarios: happy - the test file; failure - set `CSDEMO_DATABASE_URL=postgres://x` and assert startup exits non-zero with a message naming the variable. Evidence `.omo/evidence/task-7-port-to-elysia.txt`
  Commit: Y | `feat(config): port runtime configuration and sqlite URL parsing`
  Recommended task executor category: `quick`

- [ ] 8. Port the HTTP layer to `src/index.ts`
  What to do / Must NOT do: Build the Elysia app with an `/api` group containing `GET /health` → `{status:"ok"}`, `GET /cases` → array from `listCases()` mapped to `CaseOut`, `GET /cases/:case_id` → case or 404 `{detail: "Unknown case: <id>"}`, `POST /open` (validate with `OpenRequest`, compute via fairness, persist via `recordRoll`, return `{case_id, item, roll, nonce, server_hash}`), `GET /fair/commitment` → `{server_hash}`, `POST /fair/verify` → `{commitment_valid, roll}`. Register `@elysiajs/swagger` with `path: "/docs"` and note the JSON spec lives at `/docs/json`. Register `@elysiajs/static` **last** with `assets: "static"`, `prefix: "/"`, `indexHTML: true`. Add `onError` mapping (use the installed Elysia's status helper — `status(code, body)` on 1.x — so the status code is explicit): validation failures → `422` with `{detail: [{type:"validation", loc:[...], msg:<first message>}]}`; unknown route → `404` with `{detail:"Not Found"}`; unknown case → `404` with `{detail:"Unknown case: <id>"}`. Listen with `app.listen({port: 8000, hostname: "0.0.0.0"})` and register `process.on("SIGTERM", () => { app.stop(); process.exit(0); })`. Must NOT: register static before the API and swagger routes, add CORS/compression/logging middleware, change the `/api` prefix, return `{message}` envelopes, or modify anything in `static/`.
  Closes: GAP-1, GAP-2, GAP-3
  Parallelization: Wave 3 | Blocked by: 4, 5, 6, 7 | Blocks: 9, 10
  References: `src/cs_case_demo/main.py:22-36` (mount order and static), `src/cs_case_demo/routers/__init__.py:8-10` (`/api` prefix), `routers/cases.py:13-31`, `routers/fair.py:10-19`, `static/app.js:11-24` (`detail` consumption), `static/index.html` footer (`/docs`).
  Acceptance criteria (agent-executable): with the app running on 8000 and `CSDEMO_DEMO_SERVER_SEED=demo-seed-change-me`, `curl -fsS localhost:8000/api/health` returns `{"status":"ok"}`; `curl -s -o /dev/null -w '%{http_code}' localhost:8000/api/cases/nope` prints `404`; `curl -fsS localhost:8000/ | head -c 15` returns `<!doctype html>`; `curl -s -o /dev/null -w '%{http_code}' localhost:8000/docs` prints `200`.
  QA scenarios: happy - the four curl checks above; failure - `curl -s localhost:8000/api/cases/nope | grep -q 'Unknown case: nope'` and `curl -s -o /dev/null -w '%{http_code}' localhost:8000/api/../../etc/passwd` is not `200` (no path traversal through static). Evidence `.omo/evidence/task-8-port-to-elysia.txt`
  Commit: Y | `feat(api): port HTTP API and static serving to Elysia`
  Recommended task executor category: `deep-low`

- [ ] 9. Port the test suite and add fixture replay
  What to do / Must NOT do: Rewrite the five API assertions with `app.handle(new Request(...))` (no listener, no network): `GET /api/health` → `{status:"ok"}`; `GET /api/cases` → ids exactly `["recruit","vanguard","anime","zeus","knife"]` in order; `POST /api/open` for `recruit` → returned `item.id` belongs to the catalog's `recruit` items; `POST /api/open` for `nope` → 404; `GET /api/fair/commitment` then `POST /api/fair/verify` with the pinned demo seed → `commitment_valid === true`. Add `tests/parity.test.ts` replaying every `api_vectors` row: same status code, and for JSON bodies every key present in the fixture equals the responder value with `===` (numbers compared as parsed numbers, not strings). Point tests at a temp database (`CSDEMO_DATABASE_URL=sqlite:///./test-<random>.db` created and removed by the test) and pin `CSDEMO_DEMO_SERVER_SEED=demo-seed-change-me`. Must NOT: bind a port in tests, hit a real network host, delete any original assertion, or relax a comparison to a substring/epsilon.
  Closes: GAP-6, GAP-2
  Parallelization: Wave 3 | Blocked by: 3, 8 | Blocks: 10, 12
  References: `tests/test_api.py:1-63` (all five assertions), `tests/test_fairness.py` (already ported in todo 4), `tests/conftest.py:10-13` (pinned seed).
  Acceptance criteria (agent-executable): `bun test` exits 0 and reports a total ≥ 60 assertions/cases; `bun test tests/parity.test.ts` exits 0 with a per-vector name in the output.
  QA scenarios: happy - `bun test`; failure - mutate one expected fixture value in a scratch copy and confirm the replay test fails (proves the gate is live, not vacuous), then restore. Evidence `.omo/evidence/task-9-port-to-elysia.txt`
  Commit: Y | `test(api): port FastAPI suite and add parity fixture replay`
  Recommended task executor category: `unspecified-high`

- [ ] 10. Replace the Dockerfile with a Bun image on the same port and env contract
  What to do / Must NOT do: `FROM oven/bun:1-slim`, `WORKDIR /app`, copy `package.json` + `bun.lock`, `RUN bun install --frozen-lockfile --production`, then copy `src` and `static` (not `tests`, `parity`, `docs`, `k8s`), `ENV NODE_ENV=production`, `EXPOSE 8000`, `CMD ["bun","run","src/index.ts"]`. Extend `.dockerignore` with `parity`, `tests`, `.omo`, `docs`, `k8s`, keeping existing entries. Must NOT: introduce a multi-stage compile, bundle to a single binary, switch the container user, add a HEALTHCHECK (k8s probes already cover it), change the port, or copy the SQLite database into the image.
  Closes: GAP-5
  Parallelization: Wave 4 | Blocked by: 9 | Blocks: 11
  References: `Dockerfile:1-21` (current Python image, port, CMD), `.dockerignore:1-12`, `k8s/deployment.yaml:14-21` (image name pattern `localhost/cs-case-demo:<tag>`, port 8000), `scripts/deploy-hetzner.sh:16-19` (podman build then `podman save`).
  Acceptance criteria (agent-executable): `podman build -t cs-case-demo:parity .` exits 0; `podman image inspect cs-case-demo:parity --format '{{.Size}}'` is under 300000000 bytes after the layer cache settles.
  QA scenarios: happy - the build plus `podman run --rm cs-case-demo:parity bun -e 'console.log(1)'`; failure - confirm the image contains no Python: `podman run --rm cs-case-demo:parity sh -c 'command -v python3 || echo none'` prints `none`. Evidence `.omo/evidence/task-10-port-to-elysia.txt`
  Commit: Y | `build(docker): switch runtime image to Bun`
  Recommended task executor category: `unspecified-low`

- [ ] 11. Prove container parity end to end and measure the budget
  What to do / Must NOT do: Write `parity/replay.ts` — a CLI taking a base URL that replays a chosen fixture subset and prints PASS/FAIL per vector (used here and again in F3). Run the Python app on 8001 and the Bun container on 8002 with the same `CSDEMO_DEMO_SERVER_SEED=demo-seed-change-me` and separate temp databases; replay all `api_vectors` against both and diff; all must match. Then: restart the container and confirm `SELECT count(*)` is preserved; measure `podman stats --no-stream` RSS idle and under 50 sequential `/api/open` calls, plus cold start to first 200 on `/api/health`; compare against the 128Mi request / 256Mi limit. Must NOT: run against `cs-case-demo.evillab.tech`, reuse the production database or the production seed, or accept a fail-rate above zero.
  Closes: GAP-1, GAP-2, GAP-4, GAP-5
  Parallelization: Wave 4 | Blocked by: 3, 6, 10 | Blocks: 12, 14
  References: `parity/fixtures.json` (all vectors), `k8s/deployment.yaml:41-50` (requests/limits/probes), `docs/deploy-hetzner.md:15-19` (build/transfer flow).
  Acceptance criteria (agent-executable): `bun run parity/replay.ts http://127.0.0.1:8002` prints 0 failures over all vectors; recorded peak RSS is below 256Mi (state the measured number in the evidence file).
  QA scenarios: happy - the replay command; failure - point the replay at the Python port 8001 and confirm it also passes (proves the fixture set is runtime-agnostic), then record both results. Evidence `.omo/evidence/task-11-port-to-elysia.md`
  Commit: Y | `test(parity): add replay CLI and prove container parity`
  Recommended task executor category: `deep-low`

- [ ] 12. Delete the Python runtime from the repository
  What to do / Must NOT do: `git rm -r src/cs_case_demo tests/test_api.py tests/test_fairness.py tests/conftest.py pyproject.toml uv.lock .python-version` and remove `src/cs_case_demo.egg-info`, `.venv`, `__pycache__`, `.pytest_cache`, `.ruff_cache` from the working tree. Rewrite `.gitignore` to drop the Python block and keep `node_modules/`, `.omo/run-continuation/`, `.omo/drafts/`, `.omo/evidence/`, `cs-case-demo.db`, `test-*.db`. Must NOT: delete `docs/`, `static/`, `k8s/`, `scripts/`, `parity/`, the `cs-case-demo.db` file, or any fixture.
  Closes: GAP-6
  Parallelization: Wave 4 | Blocked by: 9, 11 | Blocks: 13, 14
  References: `src/cs_case_demo/` (entire tree being removed), `.gitignore:1-16`, `pyproject.toml:1-60`, `docs/deploy-hetzner.md:5` (references a FastAPI container and must be rewritten in todo 13).
  Acceptance criteria (agent-executable): `git ls-files '*.py' '*.toml' | grep -v -c '^parity/'` returns `0` for Python files; `find . -name '*.py' -not -path './node_modules/*'` prints nothing; `bun test` still exits 0.
  QA scenarios: happy - the three commands; failure - `test -f static/index.html` and `test -f cs-case-demo.db` both hold after deletion. Evidence `.omo/evidence/task-12-port-to-elysia.txt`
  Commit: Y | `chore: remove the Python runtime`
  Recommended task executor category: `quick`

- [ ] 13. Update the run, architecture and deploy documentation
  What to do / Must NOT do: In `README.md` replace the stack description, run (`bun install` then `bun run dev`, landing on `http://127.0.0.1:8000/`, docs on `/docs`), test (`bun test`, `bun run check`), the env table (`CSDEMO_DEMO_SERVER_SEED`, `CSDEMO_DEBUG`, `CSDEMO_DATABASE_URL` with both `sqlite:///relative` and `sqlite:////absolute` forms), and the layout block (`src/` modules, `tests/`, `parity/`). In `docs/implementation.md` replace the FastAPI references with the Elysia module map and add a "Parity contract" section that states the exact formula (HMAC-SHA256 over `${client_seed}:${nonce}` with the server seed as key, first 4 bytes big-endian over 2^32; commitment = SHA256 of the server seed) and points at `parity/fixtures.json` and `parity/README.md` as the oracle. In `docs/deploy-hetzner.md` update the image/runtime description, state that the container port, PVC path, probes and ingress are unchanged, and add the rollback section: the previous image stays in containerd, so `./scripts/deploy-hetzner.sh <previous-tag>` restores it. Update the stack line in `docs/backend-engineering-en-ru.md` if it names FastAPI. Extend `parity/README.md` with the replay command. Must NOT: alter `docs/market.md`, `docs/legal-ua.md`, `docs/demo-script.md`, or any product claim; must not document a feature that does not exist.
  Closes: GAP-6, GAP-7
  Parallelization: Wave 4 | Blocked by: 10, 11, 12 | Blocks: 14
  References: `README.md:1-45`, `docs/implementation.md`, `docs/deploy-hetzner.md:1-70`, `docs/backend-engineering-en-ru.md`, `parity/README.md` (created in todo 3), `package.json` scripts from todo 2.
  Acceptance criteria (agent-executable): `grep -rniE 'fastapi|uvicorn|pydantic|pytest|uv sync' README.md docs/implementation.md docs/deploy-hetzner.md` returns only lines that explicitly describe the pre-port baseline or the parity oracle; `grep -q 'bun run dev' README.md` and `grep -q 'deploy-hetzner.sh <previous-tag>' docs/deploy-hetzner.md` both exit 0.
  QA scenarios: happy - the two greps; failure - follow `README.md` verbatim from a clean clone into a temp dir and confirm `bun install && bun test` exits 0. Evidence `.omo/evidence/task-13-port-to-elysia.md`
  Commit: Y | `docs: update run, architecture and deploy docs for the Bun runtime`
  Recommended task executor category: `writing`

- [ ] 14. Deploy to Hetzner k3s and verify the live demo and rollback path
  What to do / Must NOT do: First confirm `ssh hetzner 'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get nodes'` and that `cs-case-demo.evillab.tech` resolves. Change exactly one thing in `k8s/deployment.yaml`: add `strategy: {type: Recreate}` under `spec`. Record the pre-deploy row count via `ssh hetzner "KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n cs-case-demo exec deploy/cs-case-demo -- python -c \"import sqlite3;print(sqlite3.connect('/data/cs-case-demo.db').execute('select count(*) from roll_records').fetchone()[0])\""` (or the `bun -e` equivalent once the new pod is up). Then `./scripts/deploy-hetzner.sh <new-tag>` and verify: rollout completes within 90s, pod `1/1` Ready with `RESTARTS 0` after 10 minutes, `curl -fsS https://cs-case-demo.evillab.tech/api/health` returns `{"status":"ok"}`, the landing page returns the same HTML as `static/index.html`, `/docs` returns 200, `bun run parity/replay.ts https://cs-case-demo.evillab.tech` passes the structural subset (health, case ids, open-item membership, 404 body, `/docs`) — hash equality is proven locally because production uses a real secret seed. Confirm the row count only increased and existing rows are untouched (`SELECT min(id), max(id) FROM roll_records` unchanged at the low end). Finally exercise rollback once: redeploy tag `pre-elysia`'s image if it exists, or document the exact command and stop; then redeploy the new tag. Must NOT: recreate the namespace, delete or edit the PVC/secret, change DNS, change ingress/TLS/service, apply the whole `kustomization`, edit resource limits without a measured reason, or run the replay with `CSDEMO_DEMO_SERVER_SEED` overridden against production.
  Closes: GAP-5, GAP-7
  Parallelization: Wave 5 | Blocked by: 11, 12, 13 | Blocks: F1-F4
  References: `scripts/deploy-hetzner.sh:1-40`, `k8s/deployment.yaml`, `k8s/ingress.yaml` (host + TLS), `docs/deploy-hetzner.md`, `docs/deploy-hetzner.md:41-48` (verification commands), `parity/replay.ts` (todo 11).
  Acceptance criteria (agent-executable): `ssh hetzner 'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n cs-case-demo get deploy -o jsonpath="{.status.readyReplicas}"'` prints `1`; `curl -fsS https://cs-case-demo.evillab.tech/api/health` equals `{"status":"ok"}`; the post-deploy row count is ≥ the pre-deploy count.
  QA scenarios: happy - the three acceptance commands plus `kubectl -n cs-case-demo logs deploy/cs-case-demo --tail=50` showing no repeated errors; failure - restart the Deployment and confirm the DB row count survives (`kubectl rollout restart`), proving the PVC binding is intact. Evidence `.omo/evidence/task-14-port-to-elysia.md`
  Commit: Y | `chore(k8s): use Recreate rollout for the single SQLite writer`
  Recommended task executor category: `unspecified-high`

## Final verification wave

> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.

- [ ] F1. Plan compliance audit
  Recommended task executor category: `unspecified-high`
  Diff every todo against the actual repository state: `static/` shows zero diff at every commit, no Python file remains, only the four allowed dependencies are present, `k8s/` differs by the single `strategy` block, and no todo was silently skipped or partially done. Report each todo as DONE / DEVIATED / MISSING with the command that proves it.
- [ ] F2. Code quality review
  Recommended task executor category: `unspecified-high`
  `bun run check` (biome + `tsc --noEmit`) is clean; no `any`, no non-null `!` on parsed input, no `catch {}` swallowing, no duplicated crypto or DDL constants, and `src/` modules imported only through their public exports. Record the exact command outputs.
- [ ] F3. Real manual QA
  Recommended task executor category: `deep-low`
  Drive the live site the way the demo script does: load `/`, open each of the five cases once, confirm the won card renders an item from that case with a `₴` price, run the verify dialog with the production-revealed seed path, and confirm `/api/cases` order matches the Python order. Re-run `bun run parity/replay.ts https://cs-case-demo.evillab.tech` and attach output.
- [ ] F4. Ideal-state fidelity
  Recommended task executor category: `unspecified-high`
  Walk IS-1..IS-7 one row at a time against the live system and the repo, citing the evidence file that proves each. Any row that is not fully true becomes a new `- [ ] N.` todo rather than a note.

## Commit strategy

One commit per todo on `port/elysia`, conventional-commit subjects exactly as listed. No pushes, no tags beyond `pre-elysia`, no history rewriting. Todo 11's evidence and todo 14's deploy happen after their commit so the tree is always deployable from a commit. `git diff --stat pre-elysia..HEAD -- static/` must be empty before the final wave.

## Success criteria

> One row per IS row. The plan is complete only when every IS row has a delivering todo and a proving QA scenario; F4 checks the delivered behavior against these rows 1:1, and a shortfall becomes new `- [ ] N.` rows, never a note.

| IS | Delivering todo(s) | Proving QA scenario | Evidence |
| --- | --- | --- | --- |
| IS-1 | 8, 13 | `git diff --stat pre-elysia..HEAD -- static/` empty; live `/` returns `static/index.html` | `.omo/evidence/task-8-port-to-elysia.txt`, `.omo/evidence/task-14-port-to-elysia.md` |
| IS-2 | 3, 4, 5, 8, 11 | `bun run parity/replay.ts` over all `api_vectors` with 0 failures | `.omo/evidence/task-11-port-to-elysia.md` |
| IS-3 | 8, 11 | `curl -o /dev/null -w '%{http_code}' /docs` prints 200 on both local container and live host | `.omo/evidence/task-8-port-to-elysia.txt`, `.omo/evidence/task-14-port-to-elysia.md` |
| IS-4 | 6, 11, 14 | restart container and Deployment; row count preserved; `created_at` matches `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$` | `.omo/evidence/task-6-port-to-elysia.txt`, `.omo/evidence/task-14-port-to-elysia.md` |
| IS-5 | 10, 11, 14 | `readyReplicas` = 1 within the 90s rollout; measured peak RSS under 256Mi recorded | `.omo/evidence/task-11-port-to-elysia.md`, `.omo/evidence/task-14-port-to-elysia.md` |
| IS-6 | 4, 9, 12 | `bun test` exits 0 with ≥60 cases after Python deletion; `bun run check` clean | `.omo/evidence/task-9-port-to-elysia.txt`, `.omo/evidence/task-12-port-to-elysia.txt` |
| IS-7 | 1, 13, 14 | rollback command documented and one redeploy performed | `.omo/evidence/task-14-port-to-elysia.md` |
