CREATE TABLE `shipment_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shipment_id` integer NOT NULL,
	`line_no` integer,
	`sku` text,
	`description` text,
	`po_number` text,
	`case_pack` integer,
	`units` integer,
	`cartons` integer,
	`carton_length_in` real,
	`carton_width_in` real,
	`carton_height_in` real,
	`carton_weight_kg` real,
	`cases_per_pallet` integer,
	`expected_pallets` integer,
	`cartons_received` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shipline_shipment_idx` ON `shipment_lines` (`shipment_id`);--> statement-breakpoint
CREATE INDEX `shipline_sku_idx` ON `shipment_lines` (`sku`);--> statement-breakpoint
ALTER TABLE `outbound_lines` ADD `sku` text;--> statement-breakpoint
ALTER TABLE `outbound_lines` ADD `po_number` text;--> statement-breakpoint
ALTER TABLE `outbound_lines` ADD `cartons_requested` integer;--> statement-breakpoint
ALTER TABLE `outbound_orders` ADD `consignee_name` text;--> statement-breakpoint
ALTER TABLE `outbound_orders` ADD `consignee_address` text;--> statement-breakpoint
ALTER TABLE `outbound_orders` ADD `pickup_person` text;--> statement-breakpoint
ALTER TABLE `outbound_orders` ADD `retailer_po` text;--> statement-breakpoint
ALTER TABLE `outbound_orders` ADD `load_number` text;--> statement-breakpoint
ALTER TABLE `outbound_orders` ADD `appointment_at` integer;--> statement-breakpoint
ALTER TABLE `outbound_orders` ADD `is_cross_dock` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `outbound_orders` ADD `bol_number` text;--> statement-breakpoint
ALTER TABLE `pallets` ADD `lot_number` text;--> statement-breakpoint
ALTER TABLE `pallets` ADD `handling_unit` text DEFAULT 'PALLET' NOT NULL;--> statement-breakpoint
ALTER TABLE `pallets` ADD `shipment_line_id` integer REFERENCES shipment_lines(id);--> statement-breakpoint
ALTER TABLE `pallets` ADD `sku` text;--> statement-breakpoint
ALTER TABLE `pallets` ADD `po_number` text;--> statement-breakpoint
ALTER TABLE `pallets` ADD `case_pack` integer;--> statement-breakpoint
ALTER TABLE `pallets` ADD `units` integer;--> statement-breakpoint
CREATE INDEX `pallet_sku_idx` ON `pallets` (`sku`,`po_number`);--> statement-breakpoint
CREATE INDEX `pallet_lot_idx` ON `pallets` (`lot_number`);--> statement-breakpoint
ALTER TABLE `shipments` ADD `factory_invoice` text;--> statement-breakpoint
ALTER TABLE `shipments` ADD `goods_owner` text;--> statement-breakpoint
ALTER TABLE `shipments` ADD `shipper_name` text;