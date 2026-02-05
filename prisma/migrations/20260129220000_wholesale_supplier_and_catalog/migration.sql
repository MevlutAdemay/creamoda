-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "wholesale_suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketZoneId" "MarketZone" NOT NULL,
    "styleTag" "StyleTag" NOT NULL,
    "countryId" TEXT,
    "cityId" TEXT,
    "minPriceMultiplier" TEXT NOT NULL,
    "maxPriceMultiplier" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "wholesale_catalog_items" (
    "id" TEXT NOT NULL,
    "wholesaleSupplierId" TEXT NOT NULL,
    "productTemplateId" TEXT NOT NULL,
    "wholesalePrice" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wholesale_suppliers_marketZoneId_idx" ON "wholesale_suppliers"("marketZoneId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wholesale_suppliers_isActive_idx" ON "wholesale_suppliers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "wholesale_catalog_items_wholesaleSupplierId_productTemplateId_key" ON "wholesale_catalog_items"("wholesaleSupplierId", "productTemplateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wholesale_catalog_items_wholesaleSupplierId_idx" ON "wholesale_catalog_items"("wholesaleSupplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wholesale_catalog_items_productTemplateId_idx" ON "wholesale_catalog_items"("productTemplateId");

-- AddForeignKey (ignore if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wholesale_suppliers_countryId_fkey') THEN
    ALTER TABLE "wholesale_suppliers" ADD CONSTRAINT "wholesale_suppliers_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wholesale_suppliers_cityId_fkey') THEN
    ALTER TABLE "wholesale_suppliers" ADD CONSTRAINT "wholesale_suppliers_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wholesale_catalog_items_wholesaleSupplierId_fkey') THEN
    ALTER TABLE "wholesale_catalog_items" ADD CONSTRAINT "wholesale_catalog_items_wholesaleSupplierId_fkey" FOREIGN KEY ("wholesaleSupplierId") REFERENCES "wholesale_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wholesale_catalog_items_productTemplateId_fkey') THEN
    ALTER TABLE "wholesale_catalog_items" ADD CONSTRAINT "wholesale_catalog_items_productTemplateId_fkey" FOREIGN KEY ("productTemplateId") REFERENCES "product_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "ShowcaseListing"
ADD COLUMN IF NOT EXISTS "permanentPositiveBoostPct" INTEGER NOT NULL DEFAULT 0;
