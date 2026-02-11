-- CreateEnum
CREATE TYPE "ProductionPlanStatus" AS ENUM ('DRAFT', 'LOCKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ProcurementMode" AS ENUM ('UNDECIDED', 'WHOLESALE', 'FACTORY', 'MIXED');

-- CreateEnum
CREATE TYPE "ProductionLineStatus" AS ENUM ('OPEN', 'WHOLESALE_SET', 'FACTORY_SET', 'ORDERED', 'RECEIVED', 'CANCELED');

-- CreateTable
CREATE TABLE "production_plans" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "collectionKey" TEXT NOT NULL,
    "collectionLabel" TEXT,
    "status" "ProductionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_plan_lines" (
    "id" TEXT NOT NULL,
    "productionPlanId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "playerProductId" TEXT NOT NULL,
    "procurementMode" "ProcurementMode" NOT NULL DEFAULT 'UNDECIDED',
    "status" "ProductionLineStatus" NOT NULL DEFAULT 'OPEN',
    "plannedTotalQty" INTEGER,
    "wholesaleQty" INTEGER NOT NULL DEFAULT 0,
    "factoryQty" INTEGER NOT NULL DEFAULT 0,
    "needByDate" TIMESTAMP(3),
    "expectedReceiveDate" TIMESTAMP(3),
    "wholesaleOrderId" TEXT,
    "factoryOrderId" TEXT,
    "lastActionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_plan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_plans_companyId_collectionKey_key" ON "production_plans"("companyId", "collectionKey");

-- CreateIndex
CREATE INDEX "production_plans_companyId_collectionKey_idx" ON "production_plans"("companyId", "collectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "production_plan_lines_productionPlanId_playerProductId_key" ON "production_plan_lines"("productionPlanId", "playerProductId");

-- CreateIndex
CREATE INDEX "production_plan_lines_companyId_playerProductId_idx" ON "production_plan_lines"("companyId", "playerProductId");

-- CreateIndex
CREATE INDEX "production_plan_lines_companyId_procurementMode_idx" ON "production_plan_lines"("companyId", "procurementMode");

-- CreateIndex
CREATE INDEX "production_plan_lines_companyId_status_idx" ON "production_plan_lines"("companyId", "status");

-- AddForeignKey
ALTER TABLE "production_plans" ADD CONSTRAINT "production_plans_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_lines" ADD CONSTRAINT "production_plan_lines_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "production_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_lines" ADD CONSTRAINT "production_plan_lines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_lines" ADD CONSTRAINT "production_plan_lines_playerProductId_fkey" FOREIGN KEY ("playerProductId") REFERENCES "player_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
