-- ModaverseSettlement V02 + ModaverseOrder/ModaverseOrderItem
-- Settlement: warehouse/period/payout + postedLedgerEntryId/postedAt; Orders: daily order per warehouse

-- 1) ModaverseSettlementLine: add explicit V02 columns
ALTER TABLE "modaverse_settlement_lines" ADD COLUMN IF NOT EXISTS "tierSnapshot" TEXT;
ALTER TABLE "modaverse_settlement_lines" ADD COLUMN IF NOT EXISTS "logisticsCountryFactor" DECIMAL(5,4);

-- 2) ModaverseSettlement: drop old FK and columns, add new columns
-- Handle existing data: clear lines and settlements if any (V02 is new shape)
DELETE FROM "modaverse_settlement_lines";
DELETE FROM "modaverse_settlements";

ALTER TABLE "modaverse_settlements" DROP CONSTRAINT IF EXISTS "modaverse_settlements_ledgerEntryId_fkey";
ALTER TABLE "modaverse_settlements" DROP COLUMN IF EXISTS "dayKey";
ALTER TABLE "modaverse_settlements" DROP COLUMN IF EXISTS "amountUsd";
ALTER TABLE "modaverse_settlements" DROP COLUMN IF EXISTS "ledgerEntryId";

ALTER TABLE "modaverse_settlements" ADD COLUMN IF NOT EXISTS "warehouseBuildingId" TEXT;
ALTER TABLE "modaverse_settlements" ADD COLUMN IF NOT EXISTS "periodStartDayKey" TIMESTAMP(3);
ALTER TABLE "modaverse_settlements" ADD COLUMN IF NOT EXISTS "periodEndDayKey" TIMESTAMP(3);
ALTER TABLE "modaverse_settlements" ADD COLUMN IF NOT EXISTS "payoutDayKey" TIMESTAMP(3);
ALTER TABLE "modaverse_settlements" ADD COLUMN IF NOT EXISTS "postedLedgerEntryId" TEXT;
ALTER TABLE "modaverse_settlements" ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3);

-- Fill warehouseBuildingId from first company warehouse for existing rows (none after delete; for idempotent re-run)
-- Make columns NOT NULL after backfill; here we require them for new rows
ALTER TABLE "modaverse_settlements" ALTER COLUMN "warehouseBuildingId" SET NOT NULL;
ALTER TABLE "modaverse_settlements" ALTER COLUMN "periodStartDayKey" SET NOT NULL;
ALTER TABLE "modaverse_settlements" ALTER COLUMN "periodEndDayKey" SET NOT NULL;
ALTER TABLE "modaverse_settlements" ALTER COLUMN "payoutDayKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "modaverse_settlements_companyId_warehouseBuildingId_periodS_key" ON "modaverse_settlements"("companyId", "warehouseBuildingId", "periodStartDayKey", "periodEndDayKey");
ALTER TABLE "modaverse_settlements" ADD CONSTRAINT "modaverse_settlements_warehouseBuildingId_fkey" FOREIGN KEY ("warehouseBuildingId") REFERENCES "company_buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modaverse_settlements" ADD CONSTRAINT "modaverse_settlements_postedLedgerEntryId_fkey" FOREIGN KEY ("postedLedgerEntryId") REFERENCES "company_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "modaverse_settlements_companyId_dayKey_idx";
DROP INDEX IF EXISTS "modaverse_settlements_ledgerEntryId_idx";
CREATE INDEX IF NOT EXISTS "modaverse_settlements_companyId_idx" ON "modaverse_settlements"("companyId");
CREATE INDEX IF NOT EXISTS "modaverse_settlements_warehouseBuildingId_idx" ON "modaverse_settlements"("warehouseBuildingId");
CREATE INDEX IF NOT EXISTS "modaverse_settlements_postedLedgerEntryId_idx" ON "modaverse_settlements"("postedLedgerEntryId");

-- 3) ModaverseOrder + ModaverseOrderItem
CREATE TABLE IF NOT EXISTS "modaverse_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseBuildingId" TEXT NOT NULL,
    "dayKey" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modaverse_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "modaverse_orders_warehouseBuildingId_dayKey_key" ON "modaverse_orders"("warehouseBuildingId", "dayKey");
CREATE INDEX IF NOT EXISTS "modaverse_orders_companyId_idx" ON "modaverse_orders"("companyId");
CREATE INDEX IF NOT EXISTS "modaverse_orders_warehouseBuildingId_dayKey_idx" ON "modaverse_orders"("warehouseBuildingId", "dayKey");
ALTER TABLE "modaverse_orders" ADD CONSTRAINT "modaverse_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modaverse_orders" ADD CONSTRAINT "modaverse_orders_warehouseBuildingId_fkey" FOREIGN KEY ("warehouseBuildingId") REFERENCES "company_buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "modaverse_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productTemplateId" TEXT NOT NULL,
    "playerProductId" TEXT,
    "listingId" TEXT,
    "qtyOrdered" INTEGER NOT NULL,
    "qtyFulfilled" INTEGER NOT NULL DEFAULT 0,
    "qtyShipped" INTEGER NOT NULL DEFAULT 0,
    "salePriceUsd" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modaverse_order_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "modaverse_order_items_orderId_idx" ON "modaverse_order_items"("orderId");
CREATE INDEX IF NOT EXISTS "modaverse_order_items_productTemplateId_idx" ON "modaverse_order_items"("productTemplateId");
CREATE INDEX IF NOT EXISTS "modaverse_order_items_playerProductId_idx" ON "modaverse_order_items"("playerProductId");
ALTER TABLE "modaverse_order_items" ADD CONSTRAINT "modaverse_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "modaverse_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modaverse_order_items" ADD CONSTRAINT "modaverse_order_items_productTemplateId_fkey" FOREIGN KEY ("productTemplateId") REFERENCES "product_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "modaverse_order_items" ADD CONSTRAINT "modaverse_order_items_playerProductId_fkey" FOREIGN KEY ("playerProductId") REFERENCES "player_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
