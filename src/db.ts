/**
 * SQLite persistence seam for demo roll history, ported from
 * src/cs_case_demo/database.py.
 *
 * Rows are written into the EXISTING production `roll_records` table, so the
 * DDL below must stay a no-op there and `created_at` must keep SQLAlchemy's
 * `YYYY-MM-DD HH:MM:SS.ffffff` text shape in UTC.
 */

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

import { getConfig } from "./config.ts";

const CREATE_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS roll_records (id INTEGER NOT NULL, created_at DATETIME NOT NULL, case_id VARCHAR(64) NOT NULL, item_id VARCHAR(128) NOT NULL, client_seed VARCHAR(64) NOT NULL, nonce INTEGER NOT NULL, roll FLOAT NOT NULL, server_hash VARCHAR(64) NOT NULL, PRIMARY KEY (id))";

const CREATE_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS ix_roll_records_case_id ON roll_records (case_id)";

const INSERT_SQL =
  "INSERT INTO roll_records (created_at, case_id, item_id, client_seed, nonce, roll, server_hash) VALUES (?, ?, ?, ?, ?, ?, ?)";

let db: Database | null = null;

export interface RollInput {
  readonly caseId: string;
  readonly itemId: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly roll: number;
  readonly serverHash: string;
}

/**
 * Format a Date as a UTC `YYYY-MM-DD HH:MM:SS.ffffff` string.
 *
 * SQLAlchemy stores naive UTC datetimes with microsecond precision; slicing
 * the ISO string avoids locale, timezone and date-library drift.
 */
export function formatSqliteDatetime(date: Date): string {
  const iso = date.toISOString();
  const day = iso.slice(0, 10);
  const clock = iso.slice(11, 19);
  const micros = iso.slice(20, 23).padEnd(6, "0");
  return `${day} ${clock}.${micros}`;
}

/**
 * Open the configured SQLite database, ensuring the table and index exist.
 *
 * Fails fast when the parent directory is missing instead of letting
 * bun:sqlite raise an opaque "unable to open database file".
 */
export function initDatabase(): Database {
  const { databasePath } = getConfig();
  const parent = dirname(databasePath);

  if (!existsSync(parent)) {
    throw new Error(`SQLite parent directory does not exist: ${parent}`);
  }

  if (db !== null) {
    db.close();
    db = null;
  }

  const handle = new Database(databasePath, { create: true });
  handle.exec("PRAGMA busy_timeout = 5000");
  handle.exec(CREATE_TABLE_SQL);
  handle.exec(CREATE_INDEX_SQL);

  db = handle;
  return handle;
}

/** Persist one completed deterministic roll into the audit table. */
export function recordRoll(input: RollInput): void {
  if (db === null) {
    throw new Error("Database not initialised: call initDatabase() first");
  }

  const statement = db.prepare(INSERT_SQL);
  statement.run(
    formatSqliteDatetime(new Date()),
    input.caseId,
    input.itemId,
    input.clientSeed,
    input.nonce,
    input.roll,
    input.serverHash,
  );
}

/** Close the module handle, if one is open. */
export function closeDatabase(): void {
  if (db !== null) {
    db.close();
    db = null;
  }
}
