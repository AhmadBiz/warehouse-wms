import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// ---------- Sites & physical layout ----------

export const sites = sqliteTable("sites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  address: text("address"),
  sqft: integer("sqft"),
  widthFt: real("width_ft").notNull().default(250),
  depthFt: real("depth_ft").notNull().default(140),
  palletsPerContainer: integer("pallets_per_container").notNull().default(20),
  sprinklerClearanceIn: integer("sprinkler_clearance_in"), // to confirm with client
  rafterHeightIn: integer("rafter_height_in").default(240),
});

export type ZoneKind = "DOCK" | "CROSSDOCK" | "FLOOR" | "RACK" | "BONDED" | "OVERSIZE" | "OFFICE" | "SCALE" | "HOLD";

export const zones = sqliteTable("zones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteId: integer("site_id").notNull().references(() => sites.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  kind: text("kind").$type<ZoneKind>().notNull(),
  color: text("color").notNull().default("#94a3b8"),
  // map rectangle in feet
  x: real("x").notNull(),
  y: real("y").notNull(),
  w: real("w").notNull(),
  h: real("h").notNull(),
  notes: text("notes"),
});

export type LocationKind = "RACK" | "FLOOR" | "DOOR";

export const locations = sqliteTable(
  "locations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    siteId: integer("site_id").notNull().references(() => sites.id),
    zoneId: integer("zone_id").notNull().references(() => zones.id),
    code: text("code").notNull().unique(),
    kind: text("kind").$type<LocationKind>().notNull(),
    // rack addressing
    row: text("row"),
    bay: integer("bay"),
    level: integer("level"),
    // floor lane addressing (lane accessed from the aisle; depth 1 = front)
    lane: integer("lane"),
    depth: integer("depth"),
    maxHeightIn: integer("max_height_in").notNull().default(96),
    maxWeightLb: integer("max_weight_lb").notNull().default(3000),
    maxStack: integer("max_stack").notNull().default(1), // pallets that can stack in this spot
    allowsLong: integer("allows_long", { mode: "boolean" }).notNull().default(false),
    // map rectangle in feet
    x: real("x").notNull(),
    y: real("y").notNull(),
    w: real("w").notNull(),
    h: real("h").notNull(),
    // distance from the dock (feet) used by slotting
    distanceToDockFt: real("distance_to_dock_ft").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("loc_zone_idx").on(t.zoneId), index("loc_lane_idx").on(t.lane, t.depth)]
);

// ---------- Customers ----------

export type BillingModel = "PALLET_WEEK" | "PALLET_MONTH" | "CARTON_ORDER";

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(), // 3 letters, used on labels
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  emailDomain: text("email_domain"), // for matching inbound emails
  billingModel: text("billing_model").$type<BillingModel>().notNull().default("PALLET_MONTH"),
  storageRateCents: integer("storage_rate_cents").notNull().default(1500), // per pallet per period
  handlingInCents: integer("handling_in_cents").notNull().default(800),
  handlingOutCents: integer("handling_out_cents").notNull().default(800),
  cartonPickCents: integer("carton_pick_cents").notNull().default(150),
  orderFeeCents: integer("order_fee_cents").notNull().default(1200),
  color: text("color").notNull().default("#3b82f6"),
  avgStayDays: real("avg_stay_days").notNull().default(3), // learned from history
  picksPerWeek: real("picks_per_week").notNull().default(0), // learned from history
  portalToken: text("portal_token"),
  notes: text("notes"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// ---------- Inbound ----------

export type ShipmentStatus = "ANNOUNCED" | "SCHEDULED" | "ARRIVED" | "RECEIVING" | "RECEIVED" | "CLOSED";

export const shipments = sqliteTable("shipments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteId: integer("site_id").notNull().references(() => sites.id),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  reference: text("reference").notNull(), // customer's reference / PO
  containerNumber: text("container_number"),
  carrier: text("carrier"),
  status: text("status").$type<ShipmentStatus>().notNull().default("ANNOUNCED"),
  expectedAt: integer("expected_at", { mode: "timestamp_ms" }),
  arrivedAt: integer("arrived_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  dockDoor: text("dock_door"),
  expectedPallets: integer("expected_pallets"),
  expectedCartons: integer("expected_cartons"),
  expectedWeightLb: integer("expected_weight_lb"),
  looseCartons: integer("loose_cartons", { mode: "boolean" }).notNull().default(false), // arrives as boxes, palletized on site
  isCrossDock: integer("is_cross_dock", { mode: "boolean" }).notNull().default(false),
  expectedStayDays: integer("expected_stay_days"),
  bonded: integer("bonded", { mode: "boolean" }).notNull().default(false),
  cargoControlNumber: text("cargo_control_number"),
  transactionNumber: text("transaction_number"),
  packingListReceived: integer("packing_list_received", { mode: "boolean" }).notNull().default(false),
  factoryInvoice: text("factory_invoice"), // e.g. "LT/26-27/140" on a factory packing slip
  goodsOwner: text("goods_owner"), // when the billed customer is a forwarder, whose goods these are
  shipperName: text("shipper_name"), // who handed the goods to the carrier (factory, supplier)
  notes: text("notes"),
  sourceEmailId: integer("source_email_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

// One line of a packing slip: what the paperwork says, before anything is palletized.
// Real factory slips list SKU + PO + case pack + units + cartons and nothing about pallets
// (docs/samples/README.md). Pallets are built at receiving and point back to their line.
export const shipmentLines = sqliteTable(
  "shipment_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shipmentId: integer("shipment_id").notNull().references(() => shipments.id),
    lineNo: integer("line_no"),
    sku: text("sku"),
    description: text("description"),
    poNumber: text("po_number"),
    casePack: integer("case_pack"), // units per carton
    units: integer("units"),
    cartons: integer("cartons"),
    cartonLengthIn: real("carton_length_in"),
    cartonWidthIn: real("carton_width_in"),
    cartonHeightIn: real("carton_height_in"),
    cartonWeightKg: real("carton_weight_kg"),
    casesPerPallet: integer("cases_per_pallet"), // planned or learned for this SKU
    expectedPallets: integer("expected_pallets"), // estimate = ceil(cartons / casesPerPallet)
    cartonsReceived: integer("cartons_received").notNull().default(0),
  },
  (t) => [index("shipline_shipment_idx").on(t.shipmentId), index("shipline_sku_idx").on(t.sku)]
);

export type HandlingUnit = "PALLET" | "SKID" | "BUNDLE" | "ROLL" | "CRATE" | "LOOSE";

export type PalletStatus = "EXPECTED" | "RECEIVED" | "STORED" | "ALLOCATED" | "PICKED" | "SHIPPED";
export type ConfirmSource = "SCAN" | "CAMERA" | "MANUAL" | "SYSTEM";

export const pallets = sqliteTable(
  "pallets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(), // printed on the QR label
    siteId: integer("site_id").notNull().references(() => sites.id),
    customerId: integer("customer_id").notNull().references(() => customers.id),
    shipmentId: integer("shipment_id").references(() => shipments.id),
    sequence: integer("sequence"), // n of N within the shipment
    status: text("status").$type<PalletStatus>().notNull().default("EXPECTED"),
    lotNumber: text("lot_number"), // the current system's 10-digit pallet number (0000548487); printed on the label next to the QR
    handlingUnit: text("handling_unit").$type<HandlingUnit>().notNull().default("PALLET"),
    shipmentLineId: integer("shipment_line_id").references(() => shipmentLines.id),
    sku: text("sku"),
    poNumber: text("po_number"),
    casePack: integer("case_pack"), // units per carton
    units: integer("units"), // units on the pallet (cartons × case pack)
    description: text("description"),
    cartons: integer("cartons"),
    cartonsRemaining: integer("cartons_remaining"),
    lengthIn: integer("length_in"),
    widthIn: integer("width_in"),
    heightIn: integer("height_in"),
    weightLb: integer("weight_lb"),
    stackable: integer("stackable", { mode: "boolean" }).notNull().default(true),
    oversize: integer("oversize", { mode: "boolean" }).notNull().default(false),
    bonded: integer("bonded", { mode: "boolean" }).notNull().default(false),
    cargoControlNumber: text("cargo_control_number"),
    transactionNumber: text("transaction_number"),
    expectedStayDays: integer("expected_stay_days"),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }),
    storedAt: integer("stored_at", { mode: "timestamp_ms" }),
    shippedAt: integer("shipped_at", { mode: "timestamp_ms" }),
    locationId: integer("location_id").references(() => locations.id),
    stackLevel: integer("stack_level").notNull().default(1), // 1 = on the floor, 2 = on top of another pallet
    locationConfirmedBy: text("location_confirmed_by").$type<ConfirmSource>(),
    locationConfirmedAt: integer("location_confirmed_at", { mode: "timestamp_ms" }),
    damageNotes: text("damage_notes"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("pallet_customer_idx").on(t.customerId),
    index("pallet_location_idx").on(t.locationId),
    index("pallet_status_idx").on(t.status),
    index("pallet_sku_idx").on(t.sku, t.poNumber),
    index("pallet_lot_idx").on(t.lotNumber),
  ]
);

export type MovementType = "RECEIVE" | "PUTAWAY" | "RELOCATE" | "PICK" | "SHIP" | "ADJUST" | "CONFIRM";

export const movements = sqliteTable(
  "movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    palletId: integer("pallet_id").notNull().references(() => pallets.id),
    type: text("type").$type<MovementType>().notNull(),
    fromLocationId: integer("from_location_id").references(() => locations.id),
    toLocationId: integer("to_location_id").references(() => locations.id),
    reason: text("reason"),
    source: text("source").$type<ConfirmSource>().notNull().default("MANUAL"),
    byUser: text("by_user"),
    at: integer("at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("mv_pallet_idx").on(t.palletId), index("mv_at_idx").on(t.at)]
);

// ---------- Outbound ----------

export type OrderStatus = "REQUESTED" | "PLANNED" | "PICKING" | "SHIPPED" | "CANCELLED";

export const outboundOrders = sqliteTable("outbound_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteId: integer("site_id").notNull().references(() => sites.id),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  reference: text("reference").notNull(),
  status: text("status").$type<OrderStatus>().notNull().default("REQUESTED"),
  requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  neededBy: integer("needed_by", { mode: "timestamp_ms" }),
  carrier: text("carrier"),
  dockDoor: text("dock_door"),
  shippedAt: integer("shipped_at", { mode: "timestamp_ms" }),
  consigneeName: text("consignee_name"), // who receives (a retailer DC, a store, a person picking up)
  consigneeAddress: text("consignee_address"),
  pickupPerson: text("pickup_person"),
  retailerPo: text("retailer_po"), // the consignee's PO (e.g. Walmart PO 6550842532)
  loadNumber: text("load_number"),
  appointmentAt: integer("appointment_at", { mode: "timestamp_ms" }),
  isCrossDock: integer("is_cross_dock", { mode: "boolean" }).notNull().default(false),
  bolNumber: text("bol_number"),
  notes: text("notes"),
  sourceEmailId: integer("source_email_id"),
});

export type LineStatus = "PENDING" | "PICKED" | "SHIPPED";

export const outboundLines = sqliteTable(
  "outbound_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull().references(() => outboundOrders.id),
    palletId: integer("pallet_id").notNull().references(() => pallets.id),
    cartons: integer("cartons"), // null = whole pallet
    sku: text("sku"), // what the customer asked for, as written on the request
    poNumber: text("po_number"),
    cartonsRequested: integer("cartons_requested"),
    status: text("status").$type<LineStatus>().notNull().default("PENDING"),
    pickedAt: integer("picked_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("line_order_idx").on(t.orderId)]
);

// ---------- Email ingestion ----------

export type EmailStatus = "NEW" | "PARSED" | "NEEDS_REVIEW" | "LINKED" | "IGNORED";
export type EmailKind = "INBOUND" | "OUTBOUND" | "OTHER";

export const inboundEmails = sqliteTable("inbound_emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromAddress: text("from_address").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  kind: text("kind").$type<EmailKind>().notNull().default("OTHER"),
  status: text("status").$type<EmailStatus>().notNull().default("NEW"),
  parsedJson: text("parsed_json"),
  customerId: integer("customer_id").references(() => customers.id),
  shipmentId: integer("shipment_id"),
  orderId: integer("order_id"),
  hasAttachment: integer("has_attachment", { mode: "boolean" }).notNull().default(false),
});

// ---------- Activity feed ----------

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: integer("at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    kind: text("kind").notNull(), // SHIPMENT_ANNOUNCED, LABELS_PRINTED, PALLET_RECEIVED, ...
    message: text("message").notNull(),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    byUser: text("by_user"),
  },
  (t) => [index("ev_at_idx").on(t.at)]
);

// ---------- Users ----------

export type UserRole = "ADMIN" | "OFFICE" | "FORKLIFT" | "CUSTOMER";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role").$type<UserRole>().notNull(),
  customerId: integer("customer_id").references(() => customers.id),
});

// ---------- Relations ----------

export const zonesRelations = relations(zones, ({ one, many }) => ({
  site: one(sites, { fields: [zones.siteId], references: [sites.id] }),
  locations: many(locations),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  zone: one(zones, { fields: [locations.zoneId], references: [zones.id] }),
  pallets: many(pallets),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  pallets: many(pallets),
  shipments: many(shipments),
  orders: many(outboundOrders),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  customer: one(customers, { fields: [shipments.customerId], references: [customers.id] }),
  pallets: many(pallets),
  lines: many(shipmentLines),
}));

export const shipmentLinesRelations = relations(shipmentLines, ({ one, many }) => ({
  shipment: one(shipments, { fields: [shipmentLines.shipmentId], references: [shipments.id] }),
  pallets: many(pallets),
}));

export const palletsRelations = relations(pallets, ({ one, many }) => ({
  customer: one(customers, { fields: [pallets.customerId], references: [customers.id] }),
  shipment: one(shipments, { fields: [pallets.shipmentId], references: [shipments.id] }),
  shipmentLine: one(shipmentLines, { fields: [pallets.shipmentLineId], references: [shipmentLines.id] }),
  location: one(locations, { fields: [pallets.locationId], references: [locations.id] }),
  movements: many(movements),
  lines: many(outboundLines),
}));

export const movementsRelations = relations(movements, ({ one }) => ({
  pallet: one(pallets, { fields: [movements.palletId], references: [pallets.id] }),
  from: one(locations, { fields: [movements.fromLocationId], references: [locations.id], relationName: "from" }),
  to: one(locations, { fields: [movements.toLocationId], references: [locations.id], relationName: "to" }),
}));

export const outboundOrdersRelations = relations(outboundOrders, ({ one, many }) => ({
  customer: one(customers, { fields: [outboundOrders.customerId], references: [customers.id] }),
  lines: many(outboundLines),
}));

export const outboundLinesRelations = relations(outboundLines, ({ one }) => ({
  order: one(outboundOrders, { fields: [outboundLines.orderId], references: [outboundOrders.id] }),
  pallet: one(pallets, { fields: [outboundLines.palletId], references: [pallets.id] }),
}));

export const inboundEmailsRelations = relations(inboundEmails, ({ one }) => ({
  customer: one(customers, { fields: [inboundEmails.customerId], references: [customers.id] }),
}));

// Convenience row types
export type Site = typeof sites.$inferSelect;
export type Zone = typeof zones.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Shipment = typeof shipments.$inferSelect;
export type ShipmentLine = typeof shipmentLines.$inferSelect;
export type Pallet = typeof pallets.$inferSelect;
export type Movement = typeof movements.$inferSelect;
export type OutboundOrder = typeof outboundOrders.$inferSelect;
export type OutboundLine = typeof outboundLines.$inferSelect;
export type InboundEmail = typeof inboundEmails.$inferSelect;
export type Event = typeof events.$inferSelect;
