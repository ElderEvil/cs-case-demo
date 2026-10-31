# Backend & hard engineering / Бэкенд и сложная инженерия

**Product:** Obsidian / CS Case Demo  
**Current scope:** visual prototype with fake UAH balance. No deposits, payments,
Steam login, bot inventory, withdrawals, or real-money mechanics.

This brief is written for a partner conversation. It explains the engineering
ownership and does not present the prototype as a finished gambling platform.

---

## English

### My area of ownership

I own the product's technical foundation: backend architecture, API design,
fairness logic, data model, security boundaries, deployment reliability, and
the integration path to external systems. The visible UI is only the surface;
the hard work is making every opening, balance movement, inventory action, and
withdrawal traceable, secure, and operationally reliable.

### What is already built

#### API and application structure

- **FastAPI** application with a clean split between HTTP routers, business
  services, schemas, the static catalogue, and the fairness core.
- Public demo endpoints:
  - `GET /api/cases` — catalogue, prices, items, and weights.
  - `GET /api/cases/{case_id}` — one case.
  - `POST /api/open` — deterministic demo opening.
  - `GET /api/fair/commitment` — published server-seed fingerprint.
  - `POST /api/fair/verify` — independent roll verification.
- Static frontend is served by the same app, so the demo has no separate
  frontend deployment or Node build requirement.

#### Provably-fair roll engine

- The server first publishes `SHA-256(server_seed)`, a one-way commitment.
- A roll is derived from `HMAC(server_seed, client_seed:nonce)`.
- The HMAC output is converted to a deterministic number from 0 to 1.
- The number selects an item by its declared weighted odds.
- On seed reveal, anyone can recalculate the result and check that the seed
  matches the commitment published before the roll.
- The core is deterministic and unit-tested; the API and verification endpoint
  use the same logic, avoiding two conflicting implementations.

#### Persistence and audit trail

- **SQLAlchemy 2** is installed with SQLite as the local default.
- Each completed demo opening creates an immutable `roll_records` audit row:
  timestamp, case, item, client seed, nonce, roll value, and server hash.
- The database URL is configuration-driven via `CSDEMO_DATABASE_URL`; local
  runs use `sqlite:///./cs-case-demo.db`.
- This is the starting point for reliable audit history, support tooling, and
  later fraud investigation—not a final production data system yet.

#### Quality baseline

- Automated API and fairness tests cover the present core flow.
- Ruff linting, type checking, and frontend formatting are part of the local
  workflow.
- Frontend formatting uses Biome through pnpm; Python dependencies use uv.

### Why this is the difficult part

The UI can be copied or redesigned quickly. The backend cannot be treated as a
simple “open random item” function once real users or value are involved. The
technical responsibility is to ensure that the system can answer, reliably:

- Was this opening paid for exactly once?
- Was this result generated under the published fair-play rules?
- Which user owns the resulting item?
- Can the item be withdrawn only once, and to the correct Steam account?
- What happens if a payment callback, Steam trade, or worker crashes midway?
- Can support and auditors reconstruct the entire chain of events?

### Production engineering roadmap

#### 1. Identity, sessions, and fairness hardening

- Steam OpenID authentication and account linking.
- Server-controlled session IDs and monotonically increasing nonces.
- Per-user seed changes, server-seed rotation, reveal policy, and previous-seed
  verification.
- Immutable event log for openings and account changes.
- Rate limits, idempotency keys, bot protection, and abuse monitoring.

#### 2. Financial ledger

- A double-entry-style internal ledger rather than a mutable `balance` field.
- Separate records for top-ups, promotional credit, case purchases, refunds,
  withdrawals, fees, and manual support adjustments.
- Idempotent payment-webhook handling: a provider retry must never credit a
  user twice.
- Reconciliation jobs between payment-provider reports and the internal ledger.

#### 3. Inventory and pricing

- Inventory reservation before a case is sold; do not promise an item the
  platform cannot deliver.
- Item lifecycle: available → reserved → assigned → queued for withdrawal →
  traded / failed / returned.
- Price feed ingestion, caching, confidence limits, and scheduled repricing.
- House-exposure limits for high-value items and outlier-price safeguards.

#### 4. Steam trade operations

- Isolated trade-service boundary, separate from the public API.
- Bot credentials and identity secrets stored in a proper secret manager.
- Trade-offer queue, confirmation handling, retry rules, trade-hold awareness,
  and explicit failure states.
- Steam account/trade-URL validation, inventory checks, and anti-scam controls.
- Operational dashboard: pending offers, failed confirmations, bot health, and
  inventory pressure.

#### 5. Operations and security

- PostgreSQL or managed libSQL/Turso decision for shared production data;
  SQLite remains ideal for local development and the current demo.
- Schema migrations, backups, restore drills, retention policy, and monitoring.
- Structured logs, metrics, alerting, error tracking, and audit access controls.
- Environment separation: local, staging, production; no production secrets in
  source control.
- Load testing, security review, dependency management, and incident runbooks.

### Current technical boundary

The existing SQLite/SQLAlchemy seam is intentionally modest. It proves the
data model direction and records demo rolls. It is **not** enough to claim
production readiness. Before handling money or transferrable items, the system
needs server-side nonce enforcement, a real ledger, migrations, durable hosted
storage, transaction boundaries, secrets management, and monitoring.

### Suggested partner summary

> My responsibility is the trust and operations layer: the API, provably-fair
> engine, audit trail, data model, payments/Steam integration architecture,
> security, and production reliability. The current prototype proves the user
> experience and fair-roll mechanism; my next engineering milestone is turning
> that into a controlled, auditable platform before any real-value launch.

---

## Русский

### Моя зона ответственности

Я отвечаю за технический фундамент продукта: архитектуру бэкенда, API,
логику честности, модель данных, границы безопасности, надёжность деплоя и
путь интеграции с внешними системами. Интерфейс — это только видимая часть;
сложная работа состоит в том, чтобы каждое открытие, движение баланса, действие
с инвентарём и вывод можно было проверить, восстановить и надёжно выполнить.

### Что уже сделано

#### API и структура приложения

- Приложение на **FastAPI** с разделением на HTTP-роутеры, бизнес-сервисы,
  схемы, статический каталог и ядро честного рандома.
- Публичные demo-endpoints:
  - `GET /api/cases` — каталог, цены, предметы и веса.
  - `GET /api/cases/{case_id}` — одна кейс-коллекция.
  - `POST /api/open` — детерминированное demo-открытие.
  - `GET /api/fair/commitment` — опубликованный отпечаток server seed.
  - `POST /api/fair/verify` — независимая проверка ролла.
- Статический фронтенд раздаётся тем же приложением. Поэтому для демо не нужен
  отдельный frontend-deploy или Node build.

#### Движок Provably Fair

- Сначала сервер публикует `SHA-256(server_seed)` — односторонний коммитмент.
- Ролл считается из `HMAC(server_seed, client_seed:nonce)`.
- Результат HMAC преобразуется в детерминированное число от 0 до 1.
- По этому числу выбирается предмет с заранее опубликованными весами/шансами.
- После раскрытия seed любой может пересчитать результат и проверить, что seed
  соответствует хешу, опубликованному до открытия.
- Ядро детерминировано и покрыто unit-тестами; API и endpoint проверки используют
  одну и ту же логику, поэтому две версии алгоритма не расходятся.

#### Хранение данных и аудит

- Подключён **SQLAlchemy 2**; по умолчанию локально используется SQLite.
- Каждое завершённое demo-открытие записывается в неизменяемую строку
  `roll_records`: время, кейс, предмет, client seed, nonce, значение ролла и
  server hash.
- URL базы задаётся через `CSDEMO_DATABASE_URL`; локальный вариант:
  `sqlite:///./cs-case-demo.db`.
- Это база для истории, саппорта и будущего расследования спорных случаев, но
  пока не финальная production-система данных.

#### Базовый уровень качества

- Автоматические тесты API и fair-механики покрывают текущий основной сценарий.
- В локальном процессе есть Ruff, проверка типов и форматирование фронтенда.
- Для фронтенда используется Biome через pnpm; для Python-зависимостей — uv.

### Почему это сложная часть

UI можно быстро перерисовать или собрать из готовых компонентов. Бэкенд нельзя
свести к функции «выдать случайный предмет», когда появляются реальные люди или
ценность. Техническая ответственность — уметь надёжно ответить на вопросы:

- Открытие было оплачено ровно один раз?
- Результат был сгенерирован по заранее опубликованным правилам?
- Какой пользователь владеет полученным предметом?
- Можно ли вывести предмет только один раз и на правильный Steam-аккаунт?
- Что произойдёт, если в середине процесса упадёт payment callback, Steam trade
  или worker?
- Может ли саппорт или аудит восстановить всю цепочку событий?

### Roadmap для production

#### 1. Идентификация, сессии и усиление fairness

- Steam OpenID и привязка аккаунта.
- Серверные session ID и монотонно возрастающие nonce.
- Смена user seed, ротация server seed, политика раскрытия и проверка прошлых
  seed.
- Неизменяемый event log для открытий и изменений аккаунта.
- Rate limits, idempotency keys, защита от ботов и мониторинг злоупотреблений.

#### 2. Финансовый ledger

- Внутренний ledger по принципу двойной записи вместо изменяемого поля
  `balance`.
- Отдельные записи для пополнений, бонусов, покупки кейсов, возвратов, выводов,
  комиссий и ручных корректировок саппорта.
- Идемпотентная обработка payment-webhook: повтор от провайдера не должен дважды
  начислить баланс.
- Сверка отчётов платёжного провайдера с внутренним ledger.

#### 3. Инвентарь и ценообразование

- Резервирование инвентаря до продажи кейса: нельзя обещать предмет, который
  платформа не может выдать.
- Жизненный цикл предмета: available → reserved → assigned → queued for
  withdrawal → traded / failed / returned.
- Получение цен, кэширование, лимиты доверия к цене и периодический repricing.
- Лимиты риска для дорогих предметов и защита от аномальных цен.

#### 4. Операции со Steam trade

- Изолированная граница trade-service, отдельно от публичного API.
- Учётные данные ботов и identity secret — только в нормальном secret manager.
- Очередь trade offer, confirmations, правила retry, учёт trade hold и явные
  статусы ошибок.
- Проверка Steam-аккаунта/trade URL, инвентаря и защита от скама.
- Операционный dashboard: pending offers, ошибки подтверждений, здоровье ботов
  и давление на инвентарь.

#### 5. Операции и безопасность

- Решение между PostgreSQL и managed libSQL/Turso для общей production-базы;
  SQLite остаётся хорошим выбором для локальной разработки и текущего демо.
- Миграции схемы, бэкапы, проверки восстановления, retention policy и
  мониторинг.
- Структурированные логи, метрики, алерты, error tracking и доступ к аудиту.
- Разделение окружений local / staging / production; production-секреты не
  хранятся в исходниках.
- Load testing, security review, обновление зависимостей и incident runbooks.

### Текущая техническая граница

Текущий слой SQLite/SQLAlchemy намеренно небольшой. Он показывает направление
модели данных и сохраняет demo-роллы. Он **не** означает, что продукт готов к
production. До работы с деньгами или передаваемыми предметами нужны серверный
контроль nonce, настоящий ledger, миграции, надёжное hosted-хранилище,
транзакционные границы, управление секретами и мониторинг.

### Короткая формулировка для партнёра

> Моя ответственность — слой доверия и операций: API, provably-fair движок,
> аудит, модель данных, архитектура интеграций с платежами и Steam,
> безопасность и production-надежность. Текущее демо подтверждает UX и механику
> честного ролла; следующая инженерная цель — превратить это в контролируемую и
> аудируемую платформу до любого запуска с реальной ценностью.
