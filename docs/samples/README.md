# Client documents — what they are and what they change

Thirteen photos from the client (Sept 2026): real inbound and outbound paperwork from the Saint-Laurent warehouse, the current system's warehouse receipt, and a hand sketch of the building. Handwritten notes in red are the client's ("In bound", "out bound", "XD", "How it's stored", "to drivers", carton dimensions). The `fixtures/` folder holds the same documents transcribed to JSON, for parser tests and for a realistic seed.

These are the client's operating documents and contain their customers' names and references. The repository is private; keep it that way.

## The documents

| # | File | What it is | Direction | Key facts |
| --- | --- | --- | --- | --- |
| 1 | `01-outbound-pickup-slip-rossy-17660227.jpg` | **Pickup packing slip** (release request) for part of container CMAU4573330 | Outbound | 7 lines by SKU + PO: 24,408 units / 805 cartons; picked up by a named person on Sept 29 |
| 2 | `02-inbound-factory-packing-slip-17660227-CMAU4573330.jpg` | **Factory packing slip**, full container | Inbound | 16 lines by SKU + PO: case pack, units, cartons; 31,416 units / 1,069 cartons; no pallets, no weight, no dimensions |
| 3 | `03-…-carton-dims-handwritten.jpg` | Same slip, client's copy | Inbound | Carton sizes written by hand per product type (23½×16×14, 23½×16×12, 22×16×12, 20×16×11 in) |
| 4 | `04-inbound-bol-aldev-solutions-2-skids-medical-supplies.jpg` | **Bill of lading**, LTL from Georgia via a forwarder | Inbound | 2 skids, 925 lb; consignee = the customer at the warehouse's address; no dims, no carton count |
| 5 | `05-inbound-po-pastene-diced-tomatoes-1250-cases.jpg` | **Customer's purchase order** to its supplier, delivery to the warehouse | Inbound | 1,250 cases, 28,350 lb, "Pallet QTY 0.00"; certificate of analysis, 3-axle truck |
| 6 | `06-outbound-crossdock-bol-spectrum-caledon-HAMU4446870.jpg` | **Bill of lading**, cross-dock ("XD") | Outbound | Container in → 19 pallets / 1,862 cases / 54,968 lb out to a retailer DC next morning; appointment 07:00; booked as drop |
| 7 | `07-outbound-packing-slip-ariella-fashions-walmart-dc7101.jpg` | **Retailer packing slip** printed by the warehouse for its customer | Outbound | 85 cases on 5 pallets to Walmart DC 7101; PO type, department, load #, GTIN required |
| 8 | `08-inbound-factory-packing-slip-17660227-TCNU1215415.jpg` | **Factory packing slip**, full container | Inbound | 11 lines: 41,940 units / 1,169 cartons |
| 9–10 | `09/10-warehouse-receipt-R03455-TCNU1215415-*.jpg` | **Warehouse receipt** from the current system, "How it's stored" | Internal | Container 8 after palletizing: 44 pallets, each with a lot number, cases and weight; 10,869 kg |
| 11–12 | `11/12-outbound-bol-S04101-kromet-aluminium-billets-*.jpg` | **Bill of lading** handed "to drivers", second site (Lachine) | Outbound | 90 rolls in 17 bundles of aluminium billets 5.8 m long, 35 t; by container and cast number |
| 13 | `13-warehouse-sketch-happys-warehouse.jpg` | **Site sketch** | — | 47.5 × 45.7 m + 15.5 × 7.3 m annex; 3 docks on the east wall; scale; office |

## What the documents tell us

**1. Inbound paperwork never says pallets.** Factory packing slips list SKU, PO, case pack, units and cartons. The purchase order says cases and total weight. The BOL says skids and weight. Nobody says pallet count, pallet dimensions or pallet weight, which is exactly what the questionnaire warned. The container arrives floor-loaded and the warehouse builds the pallets: 21 cases of bath towels to a pallet, 40 of hand towels, 100 of face towels, 25 of kitchen towels, 16 of face-cloth packs (receipt R03455).

*Consequence:* labels cannot always be printed before arrival in the exact number. Estimate the pallet count from cartons ÷ cases-per-pallet learned per SKU, print with spares, and let the dock screen add labels as pallets are built. The pallet count and dimensions are captured at the dock, never from the email.

**2. The current system already numbers every pallet.** Receipt R03455 gives each pallet a sequential 10-digit lot number (0000548487 …), one SKU + one PO per pallet, cases per pallet and a computed weight. Customers' paperwork refers to these.

*Consequence:* the new system's pallet code should be (or map 1:1 to) this lot number so the client's customers see nothing change. Keep `lot_number` on the pallet and print it on the label next to the QR.

**3. Outbound is requested by SKU + PO + cartons, not by pallet.** The Rossy pickup slip asks for whole PO lines (805 of 1,069 cartons). The Walmart packing slip is 85 cases on 5 pallets. Nothing names a pallet.

*Consequence:* release orders need lines by SKU/PO/cartons and an allocation step that turns a line into pallets (whole pallets first, one partial at most, oldest lot first). The pick list then works pallet by pallet as it does now.

**4. The warehouse prints the outbound paperwork.** The retailer packing slip and the BOL "to drivers" are produced by the 3PL, with retailer compliance fields (PO type, department, load number, GTIN, appointment).

*Consequence:* the system must generate a packing slip and a BOL as PDF from a release, with a per-customer template.

**5. Cross-dock loads are heavy.** 54,968 lb on 19 pallets is 2,900 lb per pallet: over any rack level and over the "heavy" threshold. Cross-dock staying on the floor by the doors is not only faster, it is the only option.

**6. Not everything is a pallet.** Aluminium billets 178 mm × 5,800 mm come as bundles of 4–6 "rolls" (~390 kg each), 17 bundles to a truck; medical supplies come as "skids". The receipt counts "PLT", the BOL counts "ROLL" and "BNDL".

*Consequence:* a `handling_unit` on each unit (pallet, skid, bundle, roll, crate, loose) and a `length_in` so long items go to the oversize area. Weights in **kg** on the receipts and BOLs, in **lb** on US paperwork: store the value and the unit.

**7. Three parties on one shipment.** The warehouse's client on the receipt is the forwarder (RKP Arrival); the goods belong to 17660227 Canada Inc; the person picking up is Rossy's buyer. The Aldev BOL has shipper, forwarder, carrier and consignee.

*Consequence:* customer = who is billed; owner and consignee are separate names on shipments and releases.

**8. Two sites are confirmed.** 5020 rue Courval, Saint-Laurent (main) and 150 boul. Montréal-Toronto, Lachine (billets). The `sites` table exists; the app currently reads only the first site.

**9. The building is smaller than stated.** The sketch gives 47.5 × 45.7 m plus a 15.5 × 7.3 m annex ≈ 2,284 m² (24,600 sq ft); the questionnaire said 35,000 sq ft. It shows three dock doors on the east wall (the questionnaire said four doors and a bay), a scale beside the docks and the office in the south-east corner. `src/db/layout.ts` now follows the sketch; confirm the numbers on site.

## Fixtures

| File | Use |
| --- | --- |
| `fixtures/inbound-packing-slip-TCNU1215415.json` | 11-line factory slip → `shipment_lines`; the container the receipt below palletized |
| `fixtures/warehouse-receipt-R03455-TCNU1215415.json` | 44 pallets with lot numbers, cases and kg → the target pallet-level record; seed material |
| `fixtures/inbound-packing-slip-CMAU4573330.json` | 16-line factory slip with handwritten carton dims |
| `fixtures/outbound-pickup-rossy-CMAU4573330.json` | The release that takes 805 of its 1,069 cartons |
| `fixtures/other-documents.json` | BOLs, the customer PO, the retailer packing slip, the billets BOL, the sketch numbers |
