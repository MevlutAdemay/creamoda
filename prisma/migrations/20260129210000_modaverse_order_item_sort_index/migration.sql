-- Add sortIndex to ModaverseOrderItem for FIFO fulfillment
ALTER TABLE "modaverse_order_items" ADD COLUMN IF NOT EXISTS "sortIndex" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "modaverse_order_items_orderId_sortIndex_idx" ON "modaverse_order_items"("orderId", "sortIndex");
CREATE INDEX IF NOT EXISTS "modaverse_order_items_listingId_idx" ON "modaverse_order_items"("listingId");
