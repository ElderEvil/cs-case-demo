/**
 * Replay the frozen FastAPI oracle (parity/fixtures.json) against a base URL.
 *
 * Usage:
 *   bun run parity/replay.ts <baseUrl> [--structural]
 *
 * Default mode replays every `api_vectors` row verbatim and asserts both the
 * status code and a deep-equal response body. `--structural` mode is for
 * production, where the real secret seed makes hash equality unprovable; it
 * checks the invariants that must hold regardless of seed.
 *
 * Exits non-zero on any failure. Dependency-free: only the global `fetch`.
 */

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

type HttpResponse = {
  readonly status: number;
  readonly body: unknown;
};

type CaseSummary = {
  readonly id: string;
  readonly itemIds: ReadonlySet<string>;
};

const EXPECTED_CASE_IDS: readonly string[] = [
  "recruit",
  "vanguard",
  "anime",
  "zeus",
  "knife",
];

const PINNED_CLIENT_SEED = "demo";

/* -------------------------------------------------------------------------- */
/* Runtime guards                                                             */
/* -------------------------------------------------------------------------- */

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

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is not an array`);
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describe(value: unknown): string {
  const text = JSON.stringify(value);
  if (text === undefined) {
    return String(value);
  }
  return text.length > 200 ? `${text.slice(0, 200)}...` : text;
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

function parseApiVector(value: unknown, index: number): ApiVector {
  const row = requireRecord(value, `api_vectors[${index}]`);
  const request = requireRecord(row.request, `api_vectors[${index}].request`);
  const response = requireRecord(
    row.response,
    `api_vectors[${index}].response`,
  );

  const parsedRequest: ApiRequest = {
    method: requireString(
      request.method,
      `api_vectors[${index}].request.method`,
    ),
    path: requireString(request.path, `api_vectors[${index}].request.path`),
    ...(request.body === undefined ? {} : { body: request.body }),
  };

  return {
    name: requireString(row.name, `api_vectors[${index}].name`),
    request: parsedRequest,
    response: {
      status: requireNumber(
        response.status,
        `api_vectors[${index}].response.status`,
      ),
      body: response.body,
    },
  };
}

function loadApiVectors(raw: unknown): ApiVector[] {
  const root = requireRecord(raw, "fixtures root");
  const rows = requireArray(root.api_vectors, "fixtures.api_vectors");
  return rows.map((row, index) => parseApiVector(row, index));
}

/* -------------------------------------------------------------------------- */
/* Comparison and HTTP                                                        */
/* -------------------------------------------------------------------------- */

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }
    if (left.length !== right.length) {
      return false;
    }
    return left.every((entry, index) => deepEqual(entry, right[index]));
  }

  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    return leftKeys.every(
      (key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]),
    );
  }

  return false;
}

async function requestJson(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<HttpResponse> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let parsed: unknown = null;
  if (text !== "") {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  return { status: response.status, body: parsed };
}

function normalizeBaseUrl(raw: string): string {
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

/* -------------------------------------------------------------------------- */
/* Default replay                                                             */
/* -------------------------------------------------------------------------- */

async function replayVector(
  baseUrl: string,
  vector: ApiVector,
): Promise<string | null> {
  const response = await requestJson(
    baseUrl,
    vector.request.method,
    vector.request.path,
    vector.request.body,
  );

  if (response.status !== vector.response.status) {
    return `status ${response.status} != expected ${vector.response.status}`;
  }

  if (!deepEqual(response.body, vector.response.body)) {
    return `body ${describe(response.body)} != expected ${describe(
      vector.response.body,
    )}`;
  }

  return null;
}

async function runReplay(
  baseUrl: string,
  vectors: ApiVector[],
): Promise<number> {
  let failures = 0;

  for (const vector of vectors) {
    try {
      const reason = await replayVector(baseUrl, vector);
      if (reason === null) {
        console.log(`PASS ${vector.name}`);
      } else {
        failures += 1;
        console.log(`FAIL ${vector.name} ${reason}`);
      }
    } catch (error) {
      failures += 1;
      console.log(`FAIL ${vector.name} ${errorMessage(error)}`);
    }
  }

  const matched = vectors.length - failures;
  console.log(`${matched}/${vectors.length} matched, ${failures} failures`);
  return failures;
}

/* -------------------------------------------------------------------------- */
/* Structural replay                                                          */
/* -------------------------------------------------------------------------- */

function parseCases(value: unknown): CaseSummary[] {
  const rows = requireArray(value, "cases body");
  return rows.map((entry, index) => {
    const record = requireRecord(entry, `cases[${index}]`);
    const id = requireString(record.id, `cases[${index}].id`);
    const items = requireArray(record.items, `cases[${index}].items`);
    const itemIds = new Set<string>();
    items.forEach((item, itemIndex) => {
      const itemRecord = requireRecord(
        item,
        `cases[${index}].items[${itemIndex}]`,
      );
      itemIds.add(
        requireString(itemRecord.id, `cases[${index}].items[${itemIndex}].id`),
      );
    });
    return { id, itemIds };
  });
}

async function runStructural(baseUrl: string): Promise<number> {
  let failures = 0;
  let cases: CaseSummary[] = [];

  async function check(
    name: string,
    run: () => Promise<string | null>,
  ): Promise<void> {
    try {
      const reason = await run();
      if (reason === null) {
        console.log(`PASS ${name}`);
      } else {
        failures += 1;
        console.log(`FAIL ${name} ${reason}`);
      }
    } catch (error) {
      failures += 1;
      console.log(`FAIL ${name} ${errorMessage(error)}`);
    }
  }

  await check("health", async () => {
    const response = await requestJson(baseUrl, "GET", "/api/health");
    if (response.status !== 200) {
      return `status ${response.status} != 200`;
    }
    if (!deepEqual(response.body, { status: "ok" })) {
      return `body ${describe(response.body)} != {"status":"ok"}`;
    }
    return null;
  });

  await check("cases", async () => {
    const response = await requestJson(baseUrl, "GET", "/api/cases");
    if (response.status !== 200) {
      return `status ${response.status} != 200`;
    }
    cases = parseCases(response.body);
    const actualIds = cases.map((summary) => summary.id);
    if (!deepEqual(actualIds, [...EXPECTED_CASE_IDS])) {
      return `ids ${describe(actualIds)} != ${describe([
        ...EXPECTED_CASE_IDS,
      ])}`;
    }
    return null;
  });

  for (const [index, caseId] of EXPECTED_CASE_IDS.entries()) {
    await check(`open_${caseId}`, async () => {
      const summary = cases.find((entry) => entry.id === caseId);
      if (summary === undefined) {
        return `case ${caseId} unavailable (cases check did not load it)`;
      }

      const response = await requestJson(baseUrl, "POST", "/api/open", {
        client_seed: PINNED_CLIENT_SEED,
        nonce: index,
        case_id: caseId,
      });
      if (response.status !== 200) {
        return `status ${response.status} != 200`;
      }

      const body = requireRecord(response.body, "open body");
      const returnedCaseId = requireString(body.case_id, "open body.case_id");
      if (returnedCaseId !== caseId) {
        return `case_id ${describe(returnedCaseId)} != ${describe(caseId)}`;
      }

      const item = requireRecord(body.item, "open body.item");
      const itemId = requireString(item.id, "open body.item.id");
      if (!summary.itemIds.has(itemId)) {
        return `item ${describe(itemId)} not in case ${caseId}`;
      }
      return null;
    });
  }

  await check("case_unknown", async () => {
    const response = await requestJson(baseUrl, "GET", "/api/cases/nope");
    if (response.status !== 404) {
      return `status ${response.status} != 404`;
    }
    const body = requireRecord(response.body, "unknown case body");
    if (body.detail !== "Unknown case: nope") {
      return `detail ${describe(body.detail)} != "Unknown case: nope"`;
    }
    return null;
  });

  await check("docs", async () => {
    const response = await requestJson(baseUrl, "GET", "/docs");
    if (response.status !== 200) {
      return `status ${response.status} != 200`;
    }
    return null;
  });

  const total = 3 + EXPECTED_CASE_IDS.length + 1;
  const passed = total - failures;
  console.log(`${passed}/${total} checks passed, ${failures} failures`);
  return failures;
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const structural = args.includes("--structural");
  const positional = args.filter((arg) => arg !== "--structural");
  const baseUrlRaw = positional[0];

  if (baseUrlRaw === undefined) {
    console.error("usage: bun run parity/replay.ts <baseUrl> [--structural]");
    process.exitCode = 2;
    return;
  }

  const baseUrl = normalizeBaseUrl(baseUrlRaw);

  if (structural) {
    const failures = await runStructural(baseUrl);
    process.exitCode = failures > 0 ? 1 : 0;
    return;
  }

  const raw: unknown = JSON.parse(
    await Bun.file(new URL("./fixtures.json", import.meta.url)).text(),
  );
  const vectors = loadApiVectors(raw);
  const failures = await runReplay(baseUrl, vectors);
  process.exitCode = failures > 0 ? 1 : 0;
}

await main();
