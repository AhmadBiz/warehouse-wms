import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seed } from "./seed";

export const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "warehouse.db");

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

// One connection per process (survives Next.js hot reloads in dev).
export const db: Db = globalThis.__warehouseDb ?? open();
if (process.env.NODE_ENV !== "production") globalThis.__warehouseDb = db;

export { schema };
