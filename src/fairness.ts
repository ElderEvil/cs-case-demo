/**
 * Provably-fair core, ported one-to-one from src/cs_case_demo/fairness.py.
 *
 * Commitment = sha256(server_seed) as hex.
 * Roll = first 4 bytes of HMAC-SHA256(key=server_seed, msg=`client_seed:nonce`)
 *        read big-endian, divided by 2^32, giving a value in [0, 1).
 */

import { createHash, createHmac, randomBytes } from "node:crypto";

const FLOAT_DENOMINATOR = 4_294_967_296;

type RollInput = {
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
};

export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function hashServerSeed(seed: string): string {
  return createHash("sha256").update(seed, "utf8").digest("hex");
}

export function rollFloat(input: RollInput): number {
  const digest = createHmac("sha256", input.serverSeed)
    .update(`${input.clientSeed}:${input.nonce}`, "utf8")
    .digest();
  return digest.readUInt32BE(0) / FLOAT_DENOMINATOR;
}

export function pickWeightedIndex(
  roll: number,
  weights: readonly number[],
): number {
  let total = 0;
  for (const weight of weights) {
    total += weight;
  }
  const target = roll * total;
  let cumulative = 0;
  for (const [index, weight] of weights.entries()) {
    cumulative += weight;
    if (target < cumulative) {
      return index;
    }
  }
  return weights.length - 1;
}

export function verifyRoll(input: RollInput, commitment: string): boolean {
  return hashServerSeed(input.serverSeed) === commitment;
}
