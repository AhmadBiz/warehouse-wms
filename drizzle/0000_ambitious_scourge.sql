CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`contact_email` text,
	`email_domain` text,
	`billing_model` text DEFAULT 'PALLET_MONTH' NOT NULL,
	`storage_rate_cents` integer DEFAULT 1500 NOT NULL,
	`handling_in_cents` integer DEFAULT 800 NOT NULL,
	`handling_out_cents` integer DEFAULT 800 NOT NULL,
	`carton_pick_cents` integer DEFAULT 150 NOT NULL,
	`order_fee_cents` integer DEFAULT 1200 NOT NULL,
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`avg_stay_days` real DEFAULT 3 NOT NULL,
	`picks_per_week` real DEFAULT 0 NOT NULL,
	`portal_token` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_code_unique` ON `customers` (`code`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`entity_type` text,
	`entity_id` integer,
	`by_user` text
);
--> statement-breakpoint
CREATE INDEX `ev_at_idx` ON `events` (`at`);--> statement-breakpoint
CREATE TABLE `inbound_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_address` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`received_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`kind` text DEFAULT 'OTHER' NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`parsed_json` text,
	`customer_id` integer,
	`shipment_id` integer,
	`order_id` integer,
	`has_attachment` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_id` integer NOT NULL,
	`zone_id` integer NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`row` text,
	`bay` integer,
	`level` integer,
	`lane` integer,
	`depth` integer,
	`max_height_in` integer DEFAULT 96 NOT NULL,
	`max_weight_lb` integer DEFAULT 3000 NOT NULL,
	`max_stack` integer DEFAULT 1 NOT NULL,
	`allows_long` integer DEFAULT false NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`w` real NOT NULL,
	`h` real NOT NULL,
	`distance_to_dock_ft` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_code_unique` ON `locations` (`code`);--> statement-breakpoint
CREATE INDEX `loc_zone_idx` ON `locations` (`zone_id`);--> statement-breakpoint
CREATE INDEX `loc_lane_idx` ON `locations` (`lane`,`depth`);--> statement-breakpoint
CREATE TABLE `movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pallet_id` integer NOT NULL,
	`type` text NOT NULL,
	`from_location_id` integer,
	`to_location_id` integer,
	`reason` text,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`by_user` text,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`pallet_id`) REFERENCES `pallets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mv_pallet_idx` ON `movements` (`pallet_id`);--> statement-breakpoint
CREATE INDEX `mv_at_idx` ON `movements` (`at`);--> statement-breakpoint
CREATE TABLE `outbound_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`pallet_id` integer NOT NULL,
	`cartons` integer,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`picked_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `outbound_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pallet_id`) REFERENCES `pallets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `line_order_idx` ON `outbound_lines` (`order_id`);--> statement-breakpoint
CREATE TABLE `outbound_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`reference` text NOT NULL,
	`status` text DEFAULT 'REQUESTED' NOT NULL,
	`requested_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`needed_by` integer,
	`carrier` text,
	`dock_door` text,
	`shipped_at` integer,
	`notes` text,
	`source_email_id` integer,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pallets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`site_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`shipment_id` integer,
	`sequence` integer,
	`status` text DEFAULT 'EXPECTED' NOT NULL,
	`description` text,
	`cartons` integer,
	`cartons_remaining` integer,
	`length_in` integer,
	`width_in` integer,
	`height_in` integer,
	`weight_lb` integer,
	`stackable` integer DEFAULT true NOT NULL,
	`oversize` integer DEFAULT false NOT NULL,
	`bonded` integer DEFAULT false NOT NULL,
	`cargo_control_number` text,
	`transaction_number` text,
	`expected_stay_days` integer,
	`received_at` integer,
	`stored_at` integer,
	`shipped_at` integer,
	`location_id` integer,
	`stack_level` integer DEFAULT 1 NOT NULL,
	`location_confirmed_by` text,
	`location_confirmed_at` integer,
	`damage_notes` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pallets_code_unique` ON `pallets` (`code`);--> statement-breakpoint
CREATE INDEX `pallet_customer_idx` ON `pallets` (`customer_id`);--> statement-breakpoint
CREATE INDEX `pallet_location_idx` ON `pallets` (`location_id`);--> statement-breakpoint
CREATE INDEX `pallet_status_idx` ON `pallets` (`status`);--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`reference` text NOT NULL,
	`container_number` text,
	`carrier` text,
	`status` text DEFAULT 'ANNOUNCED' NOT NULL,
	`expected_at` integer,
	`arrived_at` integer,
	`completed_at` integer,
	`dock_door` text,
	`expected_pallets` integer,
	`expected_cartons` integer,
	`expected_weight_lb` integer,
	`loose_cartons` integer DEFAULT false NOT NULL,
	`is_cross_dock` integer DEFAULT false NOT NULL,
	`expected_stay_days` integer,
	`bonded` integer DEFAULT false NOT NULL,
	`cargo_control_number` text,
	`transaction_number` text,
	`packing_list_received` integer DEFAULT false NOT NULL,
	`notes` text,
	`source_email_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`sqft` integer,
	`width_ft` real DEFAULT 250 NOT NULL,
	`depth_ft` real DEFAULT 140 NOT NULL,
	`pallets_per_container` integer DEFAULT 20 NOT NULL,
	`sprinkler_clearance_in` integer,
	`rafter_height_in` integer DEFAULT 240
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sites_code_unique` ON `sites` (`code`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`customer_id` integer,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `zones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`color` text DEFAULT '#94a3b8' NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`w` real NOT NULL,
	`h` real NOT NULL,
	`notes` text,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
