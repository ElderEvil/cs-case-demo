const DEFAULT_DEMO_SERVER_SEED = "demo-seed-change-me";
const DEFAULT_DATABASE_URL = "sqlite:///./cs-case-demo.db";
const SQLITE_PREFIX = "sqlite:///";

export interface Config {
  demoServerSeed: string;
  debug: boolean;
  databaseUrl: string;
  databasePath: string;
}

function parseDebug(value: string | undefined): boolean {
  return (
    value === "1" || value === "true" || value === "True" || value === "yes"
  );
}

export function parseDatabasePath(url: string): string {
  if (!url.startsWith(SQLITE_PREFIX)) {
    throw new Error(
      `CSDEMO_DATABASE_URL must start with "${SQLITE_PREFIX}" (only sqlite is supported), got: ${url}`,
    );
  }
  return url.slice(SQLITE_PREFIX.length);
}

export function getConfig(): Config {
  const resolvedDatabaseUrl =
    process.env.CSDEMO_DATABASE_URL ?? DEFAULT_DATABASE_URL;
  return {
    demoServerSeed:
      process.env.CSDEMO_DEMO_SERVER_SEED ?? DEFAULT_DEMO_SERVER_SEED,
    debug: parseDebug(process.env.CSDEMO_DEBUG),
    databaseUrl: resolvedDatabaseUrl,
    databasePath: parseDatabasePath(resolvedDatabaseUrl),
  };
}
