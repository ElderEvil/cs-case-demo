import { describe, expect, test } from "bun:test";
import {
  generateServerSeed,
  hashServerSeed,
  pickWeightedIndex,
  rollFloat,
  verifyRoll,
} from "../src/fairness";

type HashVector = {
  readonly server_seed: string;
  readonly client_seed: string;
  readonly nonce: number;
  readonly roll: number;
  readonly commitment: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHashVector(value: unknown): value is HashVector {
  return (
    isRecord(value) &&
    typeof value.server_seed === "string" &&
    typeof value.client_seed === "string" &&
    typeof value.nonce === "number" &&
    typeof value.roll === "number" &&
    typeof value.commitment === "string"
  );
}

function loadHashVectors(raw: unknown): HashVector[] {
  if (!isRecord(raw)) {
    throw new Error("fixtures root is not an object");
  }
  const rows: unknown = raw.hash_vectors;
  if (!Array.isArray(rows)) {
    throw new Error("fixtures.hash_vectors is not an array");
  }
  const parsed: unknown[] = rows;
  return parsed.map((row) => {
    if (!isHashVector(row)) {
      throw new Error(`invalid hash vector row: ${JSON.stringify(row)}`);
    }
    return row;
  });
}

const fixturesText = await Bun.file(
  new URL("../parity/fixtures.json", import.meta.url),
).text();
const fixturesRaw: unknown = JSON.parse(fixturesText);
const vectors = loadHashVectors(fixturesRaw);

describe("oracle vectors (parity/fixtures.json)", () => {
  expect(vectors.length).toBe(45);

  for (const row of vectors) {
    test(`roll matches oracle for ${row.server_seed}/${row.client_seed}/${row.nonce}`, () => {
      const roll = rollFloat({
        serverSeed: row.server_seed,
        clientSeed: row.client_seed,
        nonce: row.nonce,
      });
      expect(roll).toBe(row.roll);
    });

    test(`commitment matches oracle for ${row.server_seed}/${row.client_seed}/${row.nonce}`, () => {
      expect(hashServerSeed(row.server_seed)).toBe(row.commitment);
    });
  }
});

describe("roll determinism", () => {
  test("same input twice yields identical roll", () => {
    const input = { serverSeed: "s", clientSeed: "c", nonce: 7 };
    expect(rollFloat(input)).toBe(rollFloat(input));
  });
});

describe("roll range", () => {
  test("0 <= roll < 1 for 50 sequential nonces", () => {
    for (let nonce = 0; nonce < 50; nonce++) {
      const roll = rollFloat({ serverSeed: "s", clientSeed: "c", nonce });
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(1);
    }
  });
});

describe("commitment roundtrip", () => {
  test("verifyRoll accepts the real commitment and rejects a bogus one", () => {
    const serverSeed = generateServerSeed();
    const input = { serverSeed, clientSeed: "c", nonce: 0 };
    expect(verifyRoll(input, hashServerSeed(serverSeed))).toBe(true);
    expect(verifyRoll(input, "0".repeat(64))).toBe(false);
  });
});

describe("generateServerSeed", () => {
  test("produces 64 lowercase hex characters", () => {
    const seed = generateServerSeed();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("weighted pick", () => {
  const weights: readonly number[] = [60, 25, 10, 5];

  test("roll 0.0 picks index 0", () => {
    expect(pickWeightedIndex(0.0, weights)).toBe(0);
  });

  test("roll 0.999 picks the last index", () => {
    expect(pickWeightedIndex(0.999, weights)).toBe(3);
  });
});
