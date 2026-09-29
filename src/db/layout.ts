// Generates the physical layout (zones + locations) for the Saint-Laurent site.
// Coordinates are in feet, origin at the north-west corner, x east, y south.
//
// Building from the client's sketch (docs/samples/13-warehouse-sketch-happys-warehouse.jpg):
//   main body 47.5 m × 45.7 m, annex 15.5 m × 7.3 m on the south-east, east wall 53 m in all.
//   Three dock doors on the east wall, a scale beside them, the office in the south-east corner.
// Everything inside the walls (rack rows, lane counts, aisle widths) is a proposal until the
// client sends rack specs and the sprinkler height. Change the numbers here, run `npm run db:reset`.

export type ZoneSeed = {
  code: string;
  name: string;
  kind: "DOCK" | "CROSSDOCK" | "FLOOR" | "RACK" | "BONDED" | "OVERSIZE" | "OFFICE" | "SCALE" | "HOLD";
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  notes?: string;
};

export type LocationSeed = {
  zoneCode: string;
  code: string;
  kind: "RACK" | "FLOOR" | "DOOR";
  row?: string;
  bay?: number;
  level?: number;
  lane?: number;
  depth?: number;
  maxHeightIn: number;
  maxWeightLb: number;
  maxStack: number;
  allowsLong: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  distanceToDockFt: number;
};

const FT = 3.28084;
const r1 = (n: number) => Math.round(n * 10) / 10;

// ---- The building
export const MAIN_W = r1(47.5 * FT); // 155.8 ft
export const MAIN_D = r1(45.7 * FT); // 149.9 ft
export const ANNEX_W = r1(15.5 * FT); // 50.9 ft
export const ANNEX_D = r1(7.3 * FT); // 24.0 ft
export const TOTAL_D = r1(MAIN_D + ANNEX_D); // 173.9 ft

export const SITE = {
  code: "MTL1",
  name: "Courval warehouse",
  address: "5020 rue Courval, Saint-Laurent, QC H4T 1L1",
  widthFt: MAIN_W,
  depthFt: TOTAL_D,
  areaSqFt: Math.round(47.5 * 45.7 * 10.7639 + 15.5 * 7.3 * 10.7639), // 24,584
  areaM2: Math.round(47.5 * 45.7 + 15.5 * 7.3), // 2,284
  // Outline as a polygon, clockwise from the north-west corner.
  outline: [
    [0, 0],
    [MAIN_W, 0],
    [MAIN_W, TOTAL_D],
    [r1(MAIN_W - ANNEX_W), TOTAL_D],
    [r1(MAIN_W - ANNEX_W), MAIN_D],
    [0, MAIN_D],
  ] as [number, number][],
};

// ---- Dock doors on the east wall (the sketch shows Dock 1 nearest the scale and office, Dock 3 northmost)
const DOOR_W = 10;
const DOOR_DEPTH = 6; // how far the door marker is drawn into the building
export const DOORS = [
  { code: "D1", y: 100 },
  { code: "D2", y: 77 },
  { code: "D3", y: 54 },
];
export const DOOR_CODES = DOORS.map((d) => d.code);
const DOOR_X = MAIN_W - DOOR_DEPTH;

function distToDock(cx: number, cy: number) {
  let best = Infinity;
  for (const d of DOORS) {
    const dx = cx - MAIN_W;
    const dy = cy - (d.y + DOOR_W / 2);
    best = Math.min(best, Math.sqrt(dx * dx + dy * dy));
  }
  return Math.round(best);
}

export function buildLayout(): { zones: ZoneSeed[]; locations: LocationSeed[] } {
  // Zone boxes (feet). East side = dock side.
  const dock = { x: DOOR_X, y: 30, w: DOOR_DEPTH, h: 95 };
  const scale = { x: 121, y: 127, w: 8, h: 8 }; // beside Dock 1, between the aisle and the office
  const office = { x: 134, y: 128, w: MAIN_W - 134, h: MAIN_D - 128 };
  const hold = { x: 120, y: 5, w: 30, h: 18 };
  const staging = { x: 120, y: 30, w: 30, h: 95 }; // 5 deep (east = front) × 20 columns
  const aisle = { x: 110, y: 6, w: 10, h: 122 }; // main aisle, north–south, in front of the lanes
  const lanes = { x: 82, y: 8, w: 28, h: 120 }; // 24 lanes × 6 deep, loaded from the aisle on the east
  const racks = { x: 6, y: 6, w: 62, h: 120 }; // rows A–H in four back-to-back pairs, 20 bays, 3 levels
  const oversize = { x: 6, y: 131, w: 96, h: 17 }; // along the south wall: 5.8 m billets fit
  const annex = { x: MAIN_W - ANNEX_W + 1, y: MAIN_D + 1, w: ANNEX_W - 2, h: ANNEX_D - 2 };

  const zones: ZoneSeed[] = [
    { code: "DOCK", name: "Dock", kind: "DOCK", color: "#64748b", ...dock, notes: "Doors D1–D3 on the east wall. The questionnaire mentioned 4 doors + 1 bay: confirm." },
    { code: "SC", name: "Scale", kind: "SCALE", color: "#0f172a", ...scale, notes: "Pallets are weighed here on the way in." },
    { code: "XD", name: "Cross-dock staging", kind: "CROSSDOCK", color: "#f59e0b", ...staging, notes: "In front of the doors. Same-day pallets, never racked. Front = door side." },
    { code: "HOLD", name: "Hold / damaged", kind: "HOLD", color: "#dc2626", ...hold, notes: "Damaged, short or disputed pallets, and customs holds, until the office clears them." },
    { code: "F", name: "Floor lanes", kind: "FLOOR", color: "#3b82f6", ...lanes, notes: "24 lanes, 6 deep, stack 2. Loaded from the main aisle: depth 1 is the east end." },
    { code: "R", name: "Racking", kind: "RACK", color: "#8b5cf6", ...racks, notes: "Rows A–H (proposal), 20 bays, 3 levels. Long stays. Rack specs to confirm." },
    { code: "OS", name: "Oversize / long", kind: "OVERSIZE", color: "#ec4899", ...oversize, notes: "Along the south wall. Billet bundles up to 5.8 m; 4 bundles per position." },
    { code: "B", name: "Annex — bonded cage (proposed)", kind: "BONDED", color: "#10b981", ...annex, notes: "The 15.5 × 7.3 m annex is a separate room: the natural place for the customs bonded cage. To confirm with the client and the broker." },
    { code: "OFF", name: "Office", kind: "OFFICE", color: "#cbd5e1", ...office },
  ];

  const locations: LocationSeed[] = [];

  // Doors
  for (const d of DOORS) {
    locations.push({
      zoneCode: "DOCK", code: d.code, kind: "DOOR", maxHeightIn: 999, maxWeightLb: 99999, maxStack: 0, allowsLong: true,
      x: DOOR_X, y: d.y, w: DOOR_DEPTH, h: DOOR_W, distanceToDockFt: 0,
    });
  }

  // Cross-dock staging: 20 columns along the wall (north→south), 5 deep; depth 1 = east (door side)
  {
    const cols = 20, deep = 5;
    const cw = staging.h / cols, dw = staging.w / deep;
    for (let c = 0; c < cols; c++) {
      for (let d = 1; d <= deep; d++) {
        const n = c * deep + d;
        const x = staging.x + staging.w - d * dw, y = staging.y + c * cw;
        locations.push({
          zoneCode: "XD", code: `XD-${String(n).padStart(2, "0")}`, kind: "FLOOR", lane: 100 + c, depth: d,
          maxHeightIn: 96, maxWeightLb: 6000, maxStack: 2, allowsLong: false,
          x, y, w: dw, h: cw, distanceToDockFt: distToDock(x + dw / 2, y + cw / 2),
        });
      }
    }
  }

  // Hold: 2 rows × 6 spots, no stacking
  {
    const cols = 6, rows = 2;
    const cw = hold.w / cols, rh = hold.h / rows;
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      n++;
      const x = hold.x + c * cw, y = hold.y + r * rh;
      locations.push({ zoneCode: "HOLD", code: `H-${String(n).padStart(2, "0")}`, kind: "FLOOR", maxHeightIn: 96, maxWeightLb: 4000, maxStack: 1, allowsLong: false, x, y, w: cw, h: rh, distanceToDockFt: distToDock(x + cw / 2, y + rh / 2) });
    }
  }

  // Floor lanes: 24 lanes stacked north→south, 6 deep east→west; depth 1 = east end (at the aisle)
  {
    const count = 24, deep = 6;
    const lh = lanes.h / count, dw = lanes.w / deep;
    for (let l = 1; l <= count; l++) {
      for (let d = 1; d <= deep; d++) {
        const x = lanes.x + lanes.w - d * dw, y = lanes.y + (l - 1) * lh;
        locations.push({
          zoneCode: "F", code: `L-${String(l).padStart(2, "0")}-${d}`, kind: "FLOOR", lane: l, depth: d,
          maxHeightIn: 184, maxWeightLb: 4000, maxStack: 2, allowsLong: false,
          x, y, w: dw, h: lh, distanceToDockFt: distToDock(x + dw / 2, y + lh / 2),
        });
      }
    }
  }

  // Racking: rows A–H running north–south, back-to-back pairs with 10 ft aisles; 20 bays of 6 ft; 3 levels
  {
    const pairs = [["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"]];
    const rowW = 4, pairGap = 10, bays = 20, bh = racks.h / bays;
    const levelSpec = [
      { level: 1, maxHeightIn: 72, maxWeightLb: 4000 },
      { level: 2, maxHeightIn: 60, maxWeightLb: 2500 },
      { level: 3, maxHeightIn: 60, maxWeightLb: 2500 },
    ];
    pairs.forEach((pair, pi) => {
      const px = racks.x + pi * (2 * rowW + pairGap);
      pair.forEach((row, ri) => {
        const x = px + ri * rowW;
        for (let b = 1; b <= bays; b++) {
          const y = racks.y + (b - 1) * bh;
          for (const ls of levelSpec) {
            locations.push({
              zoneCode: "R", code: `${row}-${String(b).padStart(2, "0")}-${ls.level}`, kind: "RACK", row, bay: b, level: ls.level,
              maxHeightIn: ls.maxHeightIn, maxWeightLb: ls.maxWeightLb, maxStack: 1, allowsLong: false,
              x, y, w: rowW, h: bh, distanceToDockFt: distToDock(x + rowW / 2, y + bh / 2),
            });
          }
        }
      });
    });
  }

  // Oversize / long: 4 positions of 24 × 17 ft along the south wall, up to 4 bundles each
  {
    const n = 4, pw = oversize.w / n;
    for (let i = 0; i < n; i++) {
      const x = oversize.x + i * pw;
      locations.push({ zoneCode: "OS", code: `OS-${String(i + 1).padStart(2, "0")}`, kind: "FLOOR", maxHeightIn: 96, maxWeightLb: 25000, maxStack: 4, allowsLong: true, x, y: oversize.y, w: pw, h: oversize.h, distanceToDockFt: distToDock(x + pw / 2, oversize.y + oversize.h / 2) });
    }
  }

  // Annex / bonded cage: 7 columns × 4 rows, front (depth 1) = north row, toward the main body
  {
    const cols = 7, rows = 4;
    const cw = annex.w / cols, rh = annex.h / rows;
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      n++;
      const x = annex.x + c * cw, y = annex.y + r * rh;
      locations.push({ zoneCode: "B", code: `BD-${String(n).padStart(2, "0")}`, kind: "FLOOR", lane: 200 + c, depth: r + 1, maxHeightIn: 184, maxWeightLb: 4000, maxStack: 2, allowsLong: false, x, y, w: cw, h: rh, distanceToDockFt: distToDock(x + cw / 2, y + rh / 2) });
    }
  }

  return { zones, locations };
}
