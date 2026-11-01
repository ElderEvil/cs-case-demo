import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";

import { getCase } from "../src/catalog.ts";
import { closeDatabase, initDatabase } from "../src/db.ts";
import { app } from "../src/index.ts";

/**
 * Port of tests/test_api.py (5 assertions) driven through `app.handle()`.
 * No listener and no network: every request is an in-memory `Request`.
 */

const PINNED_DEMO_SEED = "demo-seed-change-me";
const TEST_DB_URL = `sqlite:///./test-${crypto.randomUUID()}.db`;
const TEST_DB_PATH = TEST_DB_URL.slice("sqlite:///".length);

process.env.CSDEMO_DEMO_SERVER_SEED = PINNED_DEMO_SEED;
process.env.CSDEMO_DATABASE_URL = TEST_DB_URL;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(record: unknown, key: string): string {
  if (!isRecord(record)) {
    throw new Error(`expected an object while reading "${key}"`);
  }
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`expected "${key}" to be a string, got: ${String(value)}`);
  }
  return value;
}

function readBooleanField(record: unknown, key: string): boolean {
  if (!isRecord(record)) {
    throw new Error(`expected an object while reading "${key}"`);
  }
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`expected "${key}" to be a boolean, got: ${String(value)}`);
  }
  return value;
}

/** Narrow a `GET /api/cases` body into the ordered list of case ids. */
function readCaseIds(body: unknown): string[] {
  if (!Array.isArray(body)) {
    throw new Error("expected /api/cases to return an array");
  }
  const rows: unknown[] = body;
  return rows.map((row) => readStringField(row, "id"));
}

/** Narrow a `POST /api/open` body and return the dropped item's id. */
function readOpenedItemId(body: unknown): string {
  if (!isRecord(body)) {
    throw new Error("expected /api/open to return an object");
  }
  return readStringField(body.item, "id");
}

function jsonRequest(path: string, payload: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

beforeAll(() => {
  process.env.CSDEMO_DEMO_SERVER_SEED = PINNED_DEMO_SEED;
  process.env.CSDEMO_DATABASE_URL = TEST_DB_URL;
  initDatabase();
});

afterAll(() => {
  closeDatabase();
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
});

describe("API parity with tests/test_api.py", () => {
  test("GET /api/health returns {status: ok}", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/health"),
    );
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  test("GET /api/cases lists the five demo cases in order", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/cases"),
    );
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(readCaseIds(body)).toEqual([
      "recruit",
      "vanguard",
      "anime",
      "zeus",
      "knife",
    ]);
  });

  test("POST /api/open for recruit returns an item from that case", async () => {
    const response = await app.handle(
      jsonRequest("/api/open", { case_id: "recruit" }),
    );
    expect(response.status).toBe(200);
    const body: unknown = await response.json();

    const itemId = readOpenedItemId(body);
    const recruit = getCase("recruit");
    if (recruit === undefined) {
      throw new Error("catalog is missing the recruit case");
    }
    expect(recruit.items.map((item) => item.id)).toContain(itemId);
  });

  test("POST /api/open for an unknown case is a 404", async () => {
    const response = await app.handle(
      jsonRequest("/api/open", { case_id: "nope" }),
    );
    expect(response.status).toBe(404);
    const body: unknown = await response.json();
    expect(readStringField(body, "detail")).toBe("Unknown case: nope");
  });

  test("commitment plus verify roundtrip reports commitment_valid", async () => {
    const commitmentResponse = await app.handle(
      new Request("http://localhost/api/fair/commitment"),
    );
    expect(commitmentResponse.status).toBe(200);
    const commitmentBody: unknown = await commitmentResponse.json();
    const commitment = readStringField(commitmentBody, "server_hash");

    const verifyResponse = await app.handle(
      jsonRequest("/api/fair/verify", {
        server_seed: PINNED_DEMO_SEED,
        client_seed: "demo",
        nonce: 0,
        commitment,
      }),
    );
    expect(verifyResponse.status).toBe(200);
    const verifyBody: unknown = await verifyResponse.json();
    expect(readBooleanField(verifyBody, "commitment_valid")).toBe(true);
  });
});
