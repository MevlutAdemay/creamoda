-- CreateTable
CREATE TABLE "wholesale_suppliers" (
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

-- CreateTable
CREATE TABLE "wholesale_catalog_items" (
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
CREATE INDEX "wholesale_suppliers_marketZoneId_idx" ON "wholesale_suppliers"("marketZoneId");

-- CreateIndex
CREATE INDEX "wholesale_suppliers_isActive_idx" ON "wholesale_suppliers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "wholesale_catalog_items_wholesaleSupplierId_productTemplateId_key" ON "wholesale_catalog_items"("wholesaleSupplierId", "productTemplateId");

-- CreateIndex
CREATE INDEX "wholesale_catalog_items_wholesaleSupplierId_idx" ON "wholesale_catalog_items"("wholesaleSupplierId");

-- CreateIndex
CREATE INDEX "wholesale_catalog_items_productTemplateId_idx" ON "wholesale_catalog_items"("productTemplateId");

-- AddForeignKey
ALTER TABLE "wholesale_suppliers" ADD CONSTRAINT "wholesale_suppliers_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_suppliers" ADD CONSTRAINT "wholesale_suppliers_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_catalog_items" ADD CONSTRAINT "wholesale_catalog_items_wholesaleSupplierId_fkey" FOREIGN KEY ("wholesaleSupplierId") REFERENCES "wholesale_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_catalog_items" ADD CONSTRAINT "wholesale_catalog_items_productTemplateId_fkey" FOREIGN KEY ("productTemplateId") REFERENCES "product_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
