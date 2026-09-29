// Deletes the demo database and rebuilds it with fresh "today" data.
import fs from "node:fs";
import path from "node:path";

const p = process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "warehouse.db");
for (const f of [p, p + "-wal", p + "-shm"]) if (fs.existsSync(f)) fs.unlinkSync(f);
console.log("removed", p);

// Importing the db module migrates and seeds.
import("../src/db/index").then(async (m) => {
  const { sql } = await import("drizzle-orm");
  const counts = m.db.get<{ pallets: number; locations: number; customers: number }>(
    sql`select (select count(*) from pallets) as pallets, (select count(*) from locations) as locations, (select count(*) from customers) as customers`
  );
  console.log("seeded:", counts);
});
