# Warehouse OS — demo build

Repository `warehouse-wms`. `Project Overview.md` is the original pitch and requirements summary (Sept 18); this README is how to run the demo.

Where every pallet is, how much space is left, and where the next one goes.
A working first version of the warehouse system for a 3PL client: inbound emails → QR labels → dock receiving with a suggested spot → live map and dashboard → pick lists that say what to move first → customer portal, billing and customs records.

## Run the demo

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first start creates `data/warehouse.db` and loads the demo data (20 customers, ~300 pallets, today's trucks and releases). Everything is dated relative to the moment it was created, so run this the morning of the demo:

```bash
npm run db:reset        # wipe and reload "today"
```

To show the dock screen on a phone, start with `npm run dev -- -H 0.0.0.0` and open `http://<laptop-ip>:3000/dock` on the same Wi-Fi.

Optional: copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY` so shipment and release emails are read by Claude instead of pattern matching.

## The demo path (about 15 minutes)

1. **Dashboard** `/` — space left in positions and containers, today's arrivals, releases to pick, alerts.
2. **Email inbox** `/inbox` — open the Nordika email (or paste any email in the form) → *Create shipment and labels* → *Print 14 labels*.
3. **Dock** `/dock` on the phone — tap a PLT-NRD label, enter 58" / 640 lb → *Find a spot* → the system answers with a spot and its reasons → *Confirm*. Do one more with stay = 30 days and watch it go to the racks.
4. **Map** `/map` — the two pallets light up; click any spot; switch to *Leaving when*.
5. **Outbound** `/outbound` → `MCF-REL-3310` — the pick list orders the lines, lists what to set aside and where, and enables *Picked* only once the way is clear. `NRD-REL-0924` shows a whole-pallet dig-out.
6. **Customer portal** `/portal` → Maple Crest Foods — what the customer sees.
7. **Customers** `/customers/3` — this month's billing estimate (pallet-weeks / pallet-months / orders + cartons). **Customs** `/customs` — bonded inventory, CCN and transaction numbers, audit log.

`/locations` has a *Reset demo data* button for between run-throughs.

## The client's documents

`docs/samples/` holds the client's real inbound/outbound paperwork, the current system's warehouse receipt and the sketch of the building, with an analysis of what each one changes in the system (`docs/samples/README.md`) and JSON transcriptions in `docs/samples/fixtures/` for parser tests and a realistic seed. The layout in `src/db/layout.ts` follows the sketch: 47.5 × 45.7 m plus a 15.5 × 7.3 m annex, three docks on the east wall, scale, office. `CLAUDE.md` carries the project brief and the backlog.

## What is in here

| Area | Files |
| --- | --- |
| Data model (SQLite via Drizzle) | `src/db/schema.ts`, migrations in `drizzle/` |
| Warehouse layout generator | `src/db/layout.ts` — the building from the sketch, doors, zones, racks, lanes, staging, annex, map coordinates |
| Demo data | `src/db/seed.ts` — customers, pallets, today's trucks, releases, emails |
| Slotting engine (which spot, and why) | `src/lib/slotting.ts` |
| Blocked-pallet logic and pick planning | `src/lib/blocking.ts`, `pickPlan()` in `src/lib/queries.ts` |
| Capacity / space left | `src/lib/capacity.ts` |
| Billing rules | `src/lib/billing.ts` |
| Email reader (patterns, Claude optional) | `src/lib/emailParser.ts` |
| Server actions (all writes) | `src/lib/actions.ts` |
| Screens | `src/app/**` — dashboard, map, inbound, inbox, dock, pallets, outbound, customers, customs, locations, portal |
| Map | `src/components/WarehouseMap.tsx` (SVG, click any spot) |

Stack: Next.js 16 (App Router, server actions), TypeScript, Tailwind 4, Drizzle ORM + better-sqlite3, `qrcode` for labels. Production target: same code on Postgres.

## Useful commands

```bash
npm run typecheck   # next typegen + tsc
npm run lint
npm run build && npm start
npm run db:check    # prints capacity, slotting examples and blocked pallets from the current DB
npm run db:studio   # browse the database
```

## Known limits of the demo build

- No login: everyone is "Marie" in the office and "Jean/Karim" on the forklift. Roles exist in the schema.
- The building outline and dock positions come from the client's sketch; everything inside (rows A–H, 24 lanes, rack heights 72"/60"/60") is a proposal until the client sends rack specs and the sprinkler height.
- Email reading works on pasted text; the mailbox connection and PDF packing lists are phase 2.
- Camera confirmation is modelled (a pallet's spot is "confirmed by scan / camera / never") but no camera is connected.
- Temporary moves during a dig-out are recorded; suggesting where to put those pallets back is phase 2.
- English only; French strings are phase 1 work before go-live.
