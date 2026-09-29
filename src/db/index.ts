import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as schema from "./schema";
import { seed } from "./seed";

// On Vercel only the temp directory is writable, and every function instance has its own:
// the demo data is rebuilt on each cold start and is gone when the instance is recycled.
const DEFAULT_DIR = process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), "data");

export const DB_PATH = process.env.DATABASE_URL ?? path.join(DEFAULT_DIR, "warehouse.db");

type Db = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __warehouseDb: Db | undefined;
}

function open(): Db {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  // First run: load the demo data so `npm run dev` just works.
  const { n } = db.get<{ n: number }>(sql`select count(*) as n from sites`);
  if (n === 0) {
    console.log("[warehouse-os] empty database → loading demo data");
    seed(db);
  }
  return db;
}

// One connection per process (survives Next.js hot reloads in dev), opened on first use and
// not on import: `next build` loads every page module in several worker processes at once,
// and on a fresh checkout they would all migrate and seed the same empty file.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = (globalThis.__warehouseDb ??= open());
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
