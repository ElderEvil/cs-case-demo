import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getConfig, parseDatabasePath } from "../src/config.ts";

const ENV_KEYS = [
  "CSDEMO_DEMO_SERVER_SEED",
  "CSDEMO_DEBUG",
  "CSDEMO_DATABASE_URL",
] as const;

type SavedEnv = Record<string, string | undefined>;

let savedEnv: SavedEnv;

function snapshotEnv(): SavedEnv {
  const snapshot: SavedEnv = {};
  for (const key of Object.keys(process.env)) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
}

function restoreEnv(snapshot: SavedEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  savedEnv = snapshotEnv();
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  restoreEnv(savedEnv);
});

describe("parseDatabasePath", () => {
  test("strips the sqlite:/// prefix from a relative path", () => {
    expect(parseDatabasePath("sqlite:///./cs-case-demo.db")).toBe(
      "./cs-case-demo.db",
    );
  });

  test("preserves the leading slash of an absolute path", () => {
    expect(parseDatabasePath("sqlite:////data/cs-case-demo.db")).toBe(
      "/data/cs-case-demo.db",
    );
  });

  test("throws for a non-sqlite URL and names CSDEMO_DATABASE_URL", () => {
    expect(() => parseDatabasePath("postgres://x")).toThrow(
      /CSDEMO_DATABASE_URL/,
    );
    try {
      parseDatabasePath("postgres://x");
      throw new Error("expected parseDatabasePath to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("CSDEMO_DATABASE_URL");
      expect(message).toContain("postgres://x");
    }
  });
});

describe("getConfig", () => {
  test("returns defaults when the CSDEMO vars are unset", () => {
    expect(getConfig()).toEqual({
      demoServerSeed: "demo-seed-change-me",
      debug: false,
      databaseUrl: "sqlite:///./cs-case-demo.db",
      databasePath: "./cs-case-demo.db",
    });
  });

  test("reads the environment on every call (no caching)", () => {
    process.env.CSDEMO_DEMO_SERVER_SEED = "first";
    expect(getConfig().demoServerSeed).toBe("first");
    process.env.CSDEMO_DEMO_SERVER_SEED = "second";
    expect(getConfig().demoServerSeed).toBe("second");
  });

  test("parses the debug flag from the accepted true values", () => {
    for (const value of ["1", "true", "True", "yes"]) {
      process.env.CSDEMO_DEBUG = value;
      expect(getConfig().debug).toBe(true);
    }
    process.env.CSDEMO_DEBUG = "0";
    expect(getConfig().debug).toBe(false);
  });

  test("uses CSDEMO_DATABASE_URL for databaseUrl and databasePath", () => {
    process.env.CSDEMO_DATABASE_URL = "sqlite:////data/cs-case-demo.db";
    expect(getConfig().databaseUrl).toBe("sqlite:////data/cs-case-demo.db");
    expect(getConfig().databasePath).toBe("/data/cs-case-demo.db");
  });
});
