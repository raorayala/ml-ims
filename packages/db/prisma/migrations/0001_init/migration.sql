-- ML-IMS initial schema (SQLite-compatible; ENUMs stored as CHECK constraints)

CREATE TABLE IF NOT EXISTS "suppliers" (
    "supplier_id" TEXT NOT NULL PRIMARY KEY,
    "supplier_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "reagents" (
    "reagent_id" TEXT NOT NULL PRIMARY KEY,
    "reagent_name" TEXT NOT NULL,
    "unit_of_measure" TEXT NOT NULL CHECK ("unit_of_measure" IN ('mL', 'L', 'g', 'kg', 'vials', 'packs')),
    "min_threshold_quantity" DECIMAL NOT NULL,
    "reorder_quantity" DECIMAL NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "barcode" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reagents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "reagents_barcode_key" ON "reagents"("barcode");
CREATE INDEX IF NOT EXISTS "reagents_supplier_id_idx" ON "reagents"("supplier_id");
CREATE INDEX IF NOT EXISTS "reagents_reagent_name_idx" ON "reagents"("reagent_name");

CREATE TABLE IF NOT EXISTS "inventory_lots" (
    "lot_id" TEXT NOT NULL PRIMARY KEY,
    "reagent_id" TEXT NOT NULL,
    "lot_number" TEXT NOT NULL,
    "current_quantity" DECIMAL NOT NULL,
    "storage_location" TEXT NOT NULL,
    "expiration_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Depleted', 'Expired', 'Quarantined')),
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_lots_reagent_id_fkey" FOREIGN KEY ("reagent_id") REFERENCES "reagents" ("reagent_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_lots_reagent_id_lot_number_key" ON "inventory_lots"("reagent_id", "lot_number");
CREATE INDEX IF NOT EXISTS "inventory_lots_reagent_id_idx" ON "inventory_lots"("reagent_id");
CREATE INDEX IF NOT EXISTS "inventory_lots_status_idx" ON "inventory_lots"("status");
CREATE INDEX IF NOT EXISTS "inventory_lots_expiration_date_idx" ON "inventory_lots"("expiration_date");
CREATE INDEX IF NOT EXISTS "inventory_lots_storage_location_idx" ON "inventory_lots"("storage_location");

CREATE TABLE IF NOT EXISTS "inventory_transactions" (
    "transaction_id" TEXT NOT NULL PRIMARY KEY,
    "lot_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL CHECK ("transaction_type" IN ('Check-out', 'Check-in', 'Disposal', 'Adjustment')),
    "quantity_changed" DECIMAL NOT NULL,
    "experiment_id_or_project" TEXT,
    "notes" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_transactions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots" ("lot_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inventory_transactions_lot_id_idx" ON "inventory_transactions"("lot_id");
CREATE INDEX IF NOT EXISTS "inventory_transactions_user_id_idx" ON "inventory_transactions"("user_id");
CREATE INDEX IF NOT EXISTS "inventory_transactions_timestamp_idx" ON "inventory_transactions"("timestamp");
CREATE INDEX IF NOT EXISTS "inventory_transactions_experiment_id_or_project_idx" ON "inventory_transactions"("experiment_id_or_project");

CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "po_id" TEXT NOT NULL PRIMARY KEY,
    "reagent_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "suggested_quantity" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft' CHECK ("status" IN ('Draft', 'Pending Approval', 'Submitted', 'Received')),
    "alert_payload" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "purchase_orders_reagent_id_fkey" FOREIGN KEY ("reagent_id") REFERENCES "reagents" ("reagent_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "purchase_orders_reagent_id_idx" ON "purchase_orders"("reagent_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON "purchase_orders"("status");
