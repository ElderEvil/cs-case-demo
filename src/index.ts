/**
 * Elysia HTTP layer, ported from src/cs_case_demo/main.py + routers/.
 *
 * Importing this module must stay free of side effects: no listener, no
 * database handle, no environment validation. Only `startServer()` opens the
 * database and binds the port, so tests can `import { app }` and drive it with
 * `app.handle(new Request(...))`.
 *
 * Wire format is frozen by parity/fixtures.json: responses are snake_case and
 * validation failures reproduce the Pydantic v2 error envelope.
 */

import { staticPlugin } from "@elysiajs/static";
import { swagger } from "@elysiajs/swagger";
import { Elysia, status } from "elysia";

import { type Case, type CaseItem, getCase, listCases } from "./catalog.ts";
import { getConfig } from "./config.ts";
import { closeDatabase, initDatabase, recordRoll } from "./db.ts";
import {
  hashServerSeed,
  pickWeightedIndex,
  rollFloat,
  verifyRoll,
} from "./fairness.ts";
import { OpenRequest, VerifyRequest } from "./schemas.ts";

/* -------------------------------------------------------------------------- */
/* Wire shapes                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Catalog entities are camelCase internally; the HTTP contract is snake_case.
 */
function toCaseItemOut(item: CaseItem) {
  return {
    id: item.id,
    name: item.name,
    price_uah: item.priceUah,
    weight: item.weight,
  };
}

function toCaseOut(csCase: Case) {
  return {
    id: csCase.id,
    name: csCase.name,
    price_uah: csCase.priceUah,
    items: csCase.items.map(toCaseItemOut),
  };
}

/* -------------------------------------------------------------------------- */
/* Pydantic v2 validation error mapping                                       */
/* -------------------------------------------------------------------------- */

type PydanticErrorContext = Record<string, number | string>;

interface PydanticValidationError {
  type: string;
  loc: (string | number)[];
  msg: string;
  input: unknown;
  ctx?: PydanticErrorContext;
}

/**
 * TypeBox `ValueErrorType` codes used by Elysia 1.4's `error.all` entries.
 * Numeric values are part of TypeBox's public enum, kept here as literals so
 * the HTTP layer does not import a transitive package.
 */
const STRING_MAX_LENGTH = 51;
const STRING_MIN_LENGTH = 52;
const STRING_TYPE = 54;
const INTEGER_EXCLUSIVE_MAXIMUM = 22;
const INTEGER_EXCLUSIVE_MINIMUM = 23;
const INTEGER_MAXIMUM = 24;
const INTEGER_MINIMUM = 25;
const INTEGER_TYPE = 27;
const NUMBER_EXCLUSIVE_MAXIMUM = 36;
const NUMBER_EXCLUSIVE_MINIMUM = 37;
const NUMBER_MAXIMUM = 38;
const NUMBER_MINIMUM = 39;
const NUMBER_TYPE = 41;
const OBJECT_REQUIRED_PROPERTY = 45;

function readNumber(record: unknown, key: string): number | undefined {
  if (typeof record !== "object" || record === null) {
    return undefined;
  }
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

/** Translate an Elysia error `path` (`/client_seed`) into Pydantic's `loc`. */
function toLocation(on: string, path: string): (string | number)[] {
  const locationSegment =
    on === "params" ? "path" : on === "headers" ? "header" : on;
  const loc: (string | number)[] = [locationSegment];

  for (const rawSegment of path.split("/")) {
    if (rawSegment === "") {
      continue;
    }
    const segment = rawSegment.replace(/~1/g, "/").replace(/~0/g, "~");
    loc.push(/^\d+$/.test(segment) ? Number(segment) : segment);
  }

  return loc;
}

function pluralSuffix(count: number): string {
  return count === 1 ? "" : "s";
}

type ValueErrorEntry = {
  readonly type: number;
  readonly schema: unknown;
  readonly path: string;
  readonly value: unknown;
  readonly message: string;
};

/**
 * Map one Elysia/TypeBox validation error onto Pydantic v2's shape.
 *
 * Only minLength is contract-critical (it appears in parity/fixtures.json);
 * the other common kinds are mapped for sanity and everything else falls back
 * to a well-formed 422 entry.
 */
function mapValueError(
  entry: ValueErrorEntry,
  on: string,
  inputFallback: unknown,
): PydanticValidationError {
  const loc = toLocation(on, entry.path);
  const input = entry.value === undefined ? inputFallback : entry.value;

  switch (entry.type) {
    case STRING_MIN_LENGTH: {
      const minLength = readNumber(entry.schema, "minLength") ?? 0;
      return {
        type: "string_too_short",
        loc,
        msg: `String should have at least ${minLength} character${pluralSuffix(minLength)}`,
        input,
        ctx: { min_length: minLength },
      };
    }
    case STRING_MAX_LENGTH: {
      const maxLength = readNumber(entry.schema, "maxLength") ?? 0;
      return {
        type: "string_too_long",
        loc,
        msg: `String should have at most ${maxLength} character${pluralSuffix(maxLength)}`,
        input,
        ctx: { max_length: maxLength },
      };
    }
    case STRING_TYPE:
      return {
        type: "string_type",
        loc,
        msg: "Input should be a valid string",
        input,
      };
    case INTEGER_TYPE:
      return {
        type: "int_type",
        loc,
        msg: "Input should be a valid integer",
        input,
      };
    case NUMBER_TYPE:
      return {
        type: "float_type",
        loc,
        msg: "Input should be a valid number",
        input,
      };
    case INTEGER_MINIMUM:
    case NUMBER_MINIMUM: {
      const ge = readNumber(entry.schema, "minimum") ?? 0;
      return {
        type: "greater_than_equal",
        loc,
        msg: `Input should be greater than or equal to ${ge}`,
        input,
        ctx: { ge },
      };
    }
    case INTEGER_MAXIMUM:
    case NUMBER_MAXIMUM: {
      const le = readNumber(entry.schema, "maximum") ?? 0;
      return {
        type: "less_than_equal",
        loc,
        msg: `Input should be less than or equal to ${le}`,
        input,
        ctx: { le },
      };
    }
    case INTEGER_EXCLUSIVE_MINIMUM:
    case NUMBER_EXCLUSIVE_MINIMUM: {
      const gt = readNumber(entry.schema, "exclusiveMinimum") ?? 0;
      return {
        type: "greater_than",
        loc,
        msg: `Input should be greater than ${gt}`,
        input,
        ctx: { gt },
      };
    }
    case INTEGER_EXCLUSIVE_MAXIMUM:
    case NUMBER_EXCLUSIVE_MAXIMUM: {
      const lt = readNumber(entry.schema, "exclusiveMaximum") ?? 0;
      return {
        type: "less_than",
        loc,
        msg: `Input should be less than ${lt}`,
        input,
        ctx: { lt },
      };
    }
    case OBJECT_REQUIRED_PROPERTY:
      return {
        type: "missing",
        loc,
        msg: "Field required",
        input,
      };
    default:
      return {
        type: "value_error",
        loc,
        msg: entry.message,
        input,
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

const api = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok" }))
  .get("/cases", () => listCases().map(toCaseOut))
  .get("/cases/:case_id", ({ params }) => {
    const found = getCase(params.case_id);
    if (found === undefined) {
      return status(404, { detail: `Unknown case: ${params.case_id}` });
    }
    return toCaseOut(found);
  })
  .post(
    "/open",
    ({ body }) => {
      const found = getCase(body.case_id);
      if (found === undefined) {
        return status(404, { detail: `Unknown case: ${body.case_id}` });
      }

      const { demoServerSeed } = getConfig();
      const roll = rollFloat({
        serverSeed: demoServerSeed,
        clientSeed: body.client_seed,
        nonce: body.nonce,
      });
      const itemIndex = pickWeightedIndex(
        roll,
        found.items.map((item) => item.weight),
      );
      const item = found.items[itemIndex];
      if (item === undefined) {
        throw new Error(`Case ${found.id} has no items`);
      }

      const serverHash = hashServerSeed(demoServerSeed);
      recordRoll({
        caseId: found.id,
        itemId: item.id,
        clientSeed: body.client_seed,
        nonce: body.nonce,
        roll,
        serverHash,
      });

      return {
        case_id: found.id,
        item: toCaseItemOut(item),
        roll,
        nonce: body.nonce,
        server_hash: serverHash,
      };
    },
    { body: OpenRequest },
  )
  .get("/fair/commitment", () => ({
    server_hash: hashServerSeed(getConfig().demoServerSeed),
  }))
  .post(
    "/fair/verify",
    ({ body }) => {
      const input = {
        serverSeed: body.server_seed,
        clientSeed: body.client_seed,
        nonce: body.nonce,
      };
      return {
        commitment_valid: verifyRoll(input, body.commitment),
        roll: rollFloat(input),
      };
    },
    { body: VerifyRequest },
  );

/* -------------------------------------------------------------------------- */
/* App assembly                                                               */
/* -------------------------------------------------------------------------- */

const staticAssets = await staticPlugin({
  assets: "static",
  prefix: "/",
  indexHTML: true,
});

export const app = new Elysia()
  .onError(({ code, error }) => {
    if (code === "VALIDATION") {
      const detail =
        error.all.length > 0
          ? error.all.map((entry) =>
              mapValueError(entry, error.type, error.value),
            )
          : [
              {
                type: "value_error",
                loc: [error.type],
                msg: error.message,
                input: error.value,
              },
            ];
      return status(422, { detail });
    }

    if (code === "NOT_FOUND") {
      return status(404, { detail: "Not Found" });
    }

    return undefined;
  })
  .use(api)
  .use(swagger({ path: "/docs" }))
  .use(staticAssets);

/**
 * Bind the port and open the audit database. This is the only entry point
 * allowed to call `initDatabase()`; importing `app` never touches the DB.
 */
export function startServer(): void {
  initDatabase();
  app.listen({ port: 8000, hostname: "0.0.0.0" });
  process.on("SIGTERM", () => {
    closeDatabase();
    app.stop();
    process.exit(0);
  });
}

if (import.meta.main) {
  startServer();
}
