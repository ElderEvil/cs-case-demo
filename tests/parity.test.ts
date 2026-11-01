import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";

import { closeDatabase, initDatabase } from "../src/db.ts";
import { app } from "../src/index.ts";

/**
 * Replay the 15 frozen API vectors from parity/fixtures.json through
 * `app.handle()`. Each vector becomes its own named test, so a failure names
 * the exact request that drifted from the FastAPI oracle.
 */

const PINNED_DEMO_SEED = "demo-seed-change-me";
const TEST_DB_URL = `sqlite:///./test-${crypto.randomUUID()}.db`;
const TEST_DB_PATH = TEST_DB_URL.slice("sqlite:///".length);

process.env.CSDEMO_DEMO_SERVER_SEED = PINNED_DEMO_SEED;
process.env.CSDEMO_DATABASE_URL = TEST_DB_URL;

type ApiRequest = {
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
};

type ApiResponse = {
  readonly status: number;
  readonly body: unknown;
};

type ApiVector = {
  readonly name: string;
  readonly request: ApiRequest;
  readonly response: ApiResponse;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} is not a string`);
  }
  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number") {
    throw new Error(`${label} is not a number`);
  }
  return value;
}

/** Structurally narrow one untrusted fixture row into an ApiVector. */
function parseApiVector(value: unknown): ApiVector {
  const row = requireRecord(value, "api vector");
  const request = requireRecord(row.request, "api vector request");
  const response = requireRecord(row.response, "api vector response");

  const parsedRequest: ApiRequest = {
    method: requireString(request.method, "request.method"),
    path: requireString(request.path, "request.path"),
    ...(request.body === undefined ? {} : { body: request.body }),
  };

  return {
    name: requireString(row.name, "api vector name"),
    request: parsedRequest,
    response: {
      status: requireNumber(response.status, "response.status"),
      body: response.body,
    },
  };
}

function loadApiVectors(raw: unknown): ApiVector[] {
  if (!isRecord(raw)) {
    throw new Error("fixtures root is not an object");
  }
  const rows = raw.api_vectors;
  if (!Array.isArray(rows)) {
    throw new Error("fixtures.api_vectors is not an array");
  }
  const untrusted: unknown[] = rows;
  return untrusted.map(parseApiVector);
}

function buildRequest(vector: ApiVector): Request {
  const init: RequestInit = { method: vector.request.method };
  if (vector.request.body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(vector.request.body);
  }
  return new Request(`http://localhost${vector.request.path}`, init);
}

const fixturesText = await Bun.file(
  new URL("../parity/fixtures.json", import.meta.url),
).text();
const fixturesRaw: unknown = JSON.parse(fixturesText);
const apiVectors = loadApiVectors(fixturesRaw);

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

describe("API vectors (parity/fixtures.json)", () => {
  expect(apiVectors.length).toBe(15);

  for (const vector of apiVectors) {
    test(`${vector.name}: ${vector.request.method} ${vector.request.path}`, async () => {
      const response = await app.handle(buildRequest(vector));
      expect(response.status).toBe(vector.response.status);
      const body: unknown = await response.json();
      expect(body).toEqual(vector.response.body);
      console.log(
        `PASS ${vector.name} (${vector.request.method} ${vector.request.path})`,
      );
    });
  }
});
