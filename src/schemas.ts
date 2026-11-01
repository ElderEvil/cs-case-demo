/**
 * TypeBox boundary models, ported one-to-one from src/cs_case_demo/schemas.py.
 *
 * Field names stay snake_case to match the Python API and static/app.js.
 * Pydantic ignored extra fields, so no `additionalProperties: false` here.
 */

import { t } from "elysia";

/** One drop shown in the catalog. */
export const CaseItemOut = t.Object({
  id: t.String(),
  name: t.String(),
  price_uah: t.Integer(),
  weight: t.Integer(),
});
export type CaseItemOut = typeof CaseItemOut.static;

/** A case with visible odds. */
export const CaseOut = t.Object({
  id: t.String(),
  name: t.String(),
  price_uah: t.Integer(),
  items: t.Array(CaseItemOut),
});
export type CaseOut = typeof CaseOut.static;

/** Open one case. Nonce is client-controlled for this demo. */
export const OpenRequest = t.Object({
  case_id: t.String({ minLength: 1 }),
  client_seed: t.String({ minLength: 1, maxLength: 64, default: "demo" }),
  nonce: t.Integer({ minimum: 0, default: 0 }),
});
export type OpenRequest = typeof OpenRequest.static;

/** Deterministic open result with everything needed to verify. */
export const OpenResult = t.Object({
  case_id: t.String(),
  item: CaseItemOut,
  roll: t.Number(),
  nonce: t.Integer(),
  server_hash: t.String(),
});
export type OpenResult = typeof OpenResult.static;

/** Re-derive a roll from the revealed seed. */
export const VerifyRequest = t.Object({
  server_seed: t.String({ minLength: 1 }),
  client_seed: t.String({ minLength: 1, maxLength: 64 }),
  nonce: t.Integer({ minimum: 0 }),
  commitment: t.String({ minLength: 64, maxLength: 64 }),
});
export type VerifyRequest = typeof VerifyRequest.static;

/** Verification outcome. */
export const VerifyResult = t.Object({
  commitment_valid: t.Boolean(),
  roll: t.Number(),
});
export type VerifyResult = typeof VerifyResult.static;

/** Health payload. */
export const HealthOut = t.Object({
  status: t.String(),
});
export type HealthOut = typeof HealthOut.static;

/** Pre-published server hash players can check rolls against. */
export const CommitmentOut = t.Object({
  server_hash: t.String(),
});
export type CommitmentOut = typeof CommitmentOut.static;
