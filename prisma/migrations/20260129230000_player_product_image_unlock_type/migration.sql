-- PlayerProductImage: replace unlockMethod (UnlockMethod) with unlockType (ProductImageUnlockType) to match ProductImageTemplate.
-- paidXp/paidDiamond already exist and hold template cost copy.

ALTER TABLE "player_product_images"
ADD COLUMN IF NOT EXISTS "unlockType" "ProductImageUnlockType";

UPDATE "player_product_images"
SET "unlockType" = CASE
  WHEN "unlockMethod" = 'XP' THEN 'PURCHASE_XP'::"ProductImageUnlockType"
  WHEN "unlockMethod" = 'DIAMOND' THEN 'PURCHASE_DIAMOND'::"ProductImageUnlockType"
  WHEN "unlockMethod" = 'FREE' THEN 'ALWAYS'::"ProductImageUnlockType"
  ELSE NULL
END
WHERE "unlockMethod" IS NOT NULL;

ALTER TABLE "player_product_images"
DROP COLUMN IF EXISTS "unlockMethod";
