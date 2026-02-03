# GameDay +1 Pipeline Audit Report

**Purpose:** Precise report of what runs when the game day advances by +1 (daily tick), and compliance against the locked sales design.

---

## 1. Entrypoints for GameDay +1

| # | File path | Exported / called | Notes |
|---|-----------|------------------|--------|
| 1 | `app/api/player/advance-day/route.ts` | `POST()` (default export) | Single API entry: POST /api/player/advance-day |
| 2 | `lib/game/advance-day.ts` | `advanceCompanyDay(companyId)` | Shared function; called by the API route only |
| 3 | `lib/game/run-warehouse-day-tick.ts` | `runWarehouseDayTick(companyId, warehouseBuildingId, dayKey)` | Called by advance-day.ts per warehouse |
| 4 | `lib/game/build-and-post-settlement.ts` | `buildAndPostSettlement(...)` | Called by advance-day.ts on payout days (5th/20th); **not** part of Step A/B |

**Call chain**

- **UI:** `components/shared/advance-day-panel.tsx` → `fetch('/api/player/advance-day', { method: 'POST' })`
- **API:** `app/api/player/advance-day/route.ts` → `getServerSession()` → `prisma.company.findFirst(where: { playerId })` → **`advanceCompanyDay(company.id)`**
- **advance-day.ts:** `getCompanyGameClock(companyId)` → `prisma.companyBuilding.findMany(role: WAREHOUSE)` → `prisma.companyGameClock.update(currentDayKey, ...)` → **for each warehouse: `runWarehouseDayTick(companyId, wh.id, newDayKey)`** → if payout day: `buildAndPostSettlement(companyId, wh.id, newDayKey)` per warehouse

**No cron / server actions** for advance-day; only the above API route.

---

## 2. Execution Trace (single company, single day tick)

Order of execution for one company and one advance:

1. **advance-day/route.ts – POST()**  
   - **Reads:** Session, then `Company` (by playerId).  
   - **Writes:** None.  
   - Calls `advanceCompanyDay(company.id)`.

2. **advance-day.ts – getCompanyGameClock(companyId)**  
   - **Reads:** `CompanyGameClock` (companyId).  
   - **Writes:** None.

3. **advance-day.ts – companyBuilding.findMany**  
   - **Reads:** `CompanyBuilding` (companyId, role WAREHOUSE).  
   - **Writes:** None.

4. **advance-day.ts – companyGameClock.update**  
   - **Reads:** None.  
   - **Writes:** `CompanyGameClock` (currentDayKey, version++, lastAdvancedAt).

5. **For each warehouse – runWarehouseDayTick(companyId, warehouseBuildingId, newDayKey)**  
   - Runs inside **one** `prisma.$transaction` per warehouse.  
   - **Inputs:** companyId, warehouseBuildingId, dayKey (normalized UTC midnight).  
   - See Step A and Step B below.

### Step A (order generation) – inside runWarehouseDayTick transaction

6. **ModaverseOrder.findUnique**  
   - **Reads:** `ModaverseOrder` (warehouseBuildingId, dayKey).  
   - **Writes:** None.  
   - Idempotency: if order exists, skip Step A (and Step A log upserts).

7. **CompanyBuilding.findUnique**  
   - **Reads:** `CompanyBuilding` (id = warehouseBuildingId) → marketZone.  
   - **Writes:** None.

8. **ShowcaseListing.findMany**  
   - **Reads:** `ShowcaseListing` (companyId, warehouseBuildingId, status LISTED).  
   - **Select (snapshot only):** id, productTemplateId, playerProductId, salePrice, listPrice, **baseQty, baseMinDaily, baseMaxDaily, tierUsed**, positiveBoostPct, negativeBoostPct, **priceIndex, priceMultiplier, blockedByPrice**, seasonScore, blockedBySeason.  
   - **Does not select:** bandConfigId, normalPrice (not needed for formula).  
   - **Does not call:** demand.ts, band resolution, price-index recompute.  
   - **Inputs used:** Only listing snapshot + inventory qtyOnHand.

9. **BuildingInventoryItem.findMany**  
   - **Reads:** `BuildingInventoryItem` (companyBuildingId, productTemplateId in templateIds).  
   - **Writes:** None.

10. **Per listing – compute orderedQty (in memory)**  
    - baseDesired = listing.baseQty ?? 0  
    - unitsAfterBoost = baseDesired * (1 + positiveBoostPct/100) * (1 - negativeBoostPct/100)  
    - unitsAfterPrice = unitsAfterBoost * (listing.priceMultiplier ?? 1)  
    - seasonMultiplier = (listing.seasonScore ?? 100) / 100  
    - finalUnits = blockedBySeason ? 0 : unitsAfterPrice * seasonMultiplier  
    - orderedQty = min(round(finalUnits), qtyOnHand)  
    - **All inputs from ShowcaseListing snapshot + inv.qtyOnHand.**

11. **Per listing – DailyProductSalesLog.upsert**  
    - **Writes:** `DailyProductSalesLog` (listingKey = listing.id, dayKey = normalizedDayKey).  
    - **Unique key:** (listingKey, dayKey).  
    - **Create/update:** qtyOrdered, expectedUnits, finalUnits, tierUsed, baseMinDaily, baseMaxDaily, baseQty, positiveBoostPct, negativeBoostPct, priceIndex, priceMultiplier, blockedByPrice, seasonScore, seasonMultiplier, blockedBySeason, reasonsSnapshot, salePrice, listPrice.  
    - **Done for every LISTED listing**, including when orderedQty === 0.  
    - **Compliant:** Log for every listing, every day; key (listingKey, dayKey).

12. **Out-of-stock – ShowcaseListing.deleteMany**  
    - **Writes:** `ShowcaseListing` (delete where id = listing.id).  
    - **When:** !inv \|\| inv.qtyOnHand <= 0 (before order) **or** newQtyOnHand === 0 after reserving order qty.  
    - **Compliant:** Delete (not pause).

13. **ModaverseOrder.create + ModaverseOrderItem.create** (only if hasAnyOrder)  
    - **Writes:** `ModaverseOrder`, `ModaverseOrderItem` (listingId, productTemplateId, playerProductId, qtyOrdered, sortIndex, salePriceUsd).  
    - Only for items with orderedQty > 0 and inv present.

### Step B (fulfillment) – same transaction

14. **BuildingMetricState.findUnique + MetricLevelConfig.findUnique**  
    - **Reads:** Capacity (SALES_COUNT level → maxAllowed).  
    - **Writes:** None.

15. **ModaverseOrderItem.findMany** (backlog)  
    - **Reads:** `ModaverseOrderItem` (order.warehouseBuildingId, companyId), order by order.dayKey asc, sortIndex asc.  
    - **Writes:** None.  
    - Filter: qtyFulfilled < qtyOrdered.

16. **Per backlog item – BuildingInventoryItem.findUnique**  
    - **Reads:** `BuildingInventoryItem` (warehouse, productTemplateId).  
    - **Writes:** None.

17. **Per backlog item – BuildingInventoryItem.update (decrement qtyOnHand)**  
    - **Writes:** `BuildingInventoryItem`.  
    - **Reads:** None.

18. **Per backlog item – InventoryMovement.create**  
    - **Writes:** `InventoryMovement` (OUT, SALES_FULFILLMENT).  
    - **Reads:** None.

19. **Per backlog item – ModaverseOrderItem.update (qtyFulfilled, qtyShipped increment)**  
    - **Writes:** `ModaverseOrderItem`.  
    - **Reads:** None.

20. **Per backlog item – DailyProductSalesLog.upsert (Step B)**  
    - **Writes:** `DailyProductSalesLog` (listingKey = **item.listingId**, dayKey = **order.dayKey**).  
    - **Unique key:** (listingKey, dayKey).  
    - **Does not load ShowcaseListing;** uses listingId from ModaverseOrderItem.  
    - **Create:** companyId, listingKey, listingId, marketZone, warehouseBuildingId, productTemplateId, playerProductId, dayKey, qtyOrdered: 0, qtyShipped: ship.  
    - **Update:** qtyShipped += ship.  
    - **Compliant:** Upsert by (listingKey, dayKey); does not rely on listing existing.

21. **Out-of-stock after ship – ShowcaseListing.deleteMany**  
    - **Writes:** `ShowcaseListing` (delete where id = item.listingId).  
    - **When:** newQtyOnHand === 0 && item.listingId.  
    - **Compliant:** Delete (not pause).

---

## 3. Compliance Check

| Rule | Status | Notes |
|------|--------|--------|
| **A) Step A reads ONLY from ShowcaseListing snapshot** (baseQty, baseMinDaily, baseMaxDaily, tierUsed, bandConfigId; normalPrice, priceIndex, priceMultiplier, blockedByPrice; positiveBoostPct, negativeBoostPct, boostSnapshot; seasonScore) | ✅ Compliant | Step A selects and uses only snapshot fields. bandConfigId / normalPrice not used in formula but are not recomputed. |
| **B) Step A must NOT recalculate** band, price index/multiplier, demand.ts | ✅ Compliant | No demand.ts import or call in run-warehouse-day-tick. No band resolution, no price-index recompute. |
| **C) DailyProductSalesLog upserted for every LISTED listing, every day** (even orderedQty === 0); unique key (listingKey, dayKey) | ✅ Compliant | Loop over stepAItems; upsert for each; key (listingKey, dayKey). |
| **D) Out-of-stock:** delete ShowcaseListing (deleteMany); keep logs; listingId can become null, listingKey stays | ✅ Compliant | deleteMany used; log uses listingKey (listing.id); listingId on log can be nulled by FK. |
| **E) Step B upserts logs by (listingKey, dayKey); must not rely on listing existing** | ✅ Compliant | Step B uses item.listingId from ModaverseOrderItem as listingKey; no ShowcaseListing read. |

---

## 4. Violations and Removals

- **demand.ts:** Not used in run-warehouse-day-tick (no import, no call). Comment in `lib/game/demand.ts` says "Used by run-warehouse-day-tick for logging" — **outdated**; can be corrected for clarity (see below).
- **Band/price recomputation during tick:** None found.
- **Skipping logs for zero-sales:** None; every stepAItem gets a log upsert.
- **Pause instead of delete on OOS:** None; deleteMany is used.
- **Step B reliance on listing existing:** None; Step B uses order item’s listingId only.

**Conclusion:** No logic removal required in run-warehouse-day-tick or advance-day for compliance. Only optional doc fix in demand.ts.

---

## 5. Code Changes Performed

1. **lib/game/demand.ts**  
   - **Change:** Update the JSDoc that says "Used by run-warehouse-day-tick for logging" to state that the daily tick does **not** use this module (snapshot-only).  
   - **Reason:** Avoid future confusion and accidental use of demand in the tick.

No other code changes required; pipeline already matches the locked design.

---

## 6. Harden advance-day (minimal guards)

### 6.1 Concurrency guard

- **Behavior:** Clock update uses `updateMany` with `where: { companyId, version: clock.version }` and `data: { currentDayKey, version: clock.version + 1, lastAdvancedAt }`. If `updated.count === 0`, another request advanced the day in between; we throw `ADVANCE_DAY_CONCURRENT`.
- **API:** The route catches that error and returns **HTTP 409** with body `{ error: "Already advanced / concurrent request" }`.
- **Effect:** Two simultaneous POSTs cannot both advance the day; the second gets 409 and does not run warehouse ticks or settlement.

### 6.2 Log guarantee when order already exists

- **Behavior:** Step A no longer skips the listing loop when `existingOrder` exists. We always load LISTED listings, build `stepAItems` from snapshot, and **always** run the DailyProductSalesLog upsert loop for every listing (key `listingKey_dayKey`). We then run OOS delete for listings with no inventory. Only **after** that do we check `if (!existingOrder)` to create ModaverseOrder + ModaverseOrderItem and decrement inventory.
- **Effect:** Every day, every LISTED listing gets a DailyProductSalesLog row for that day, even if an order for that (warehouse, dayKey) already existed (e.g. from a prior partial run or retry). Order/item creation remains idempotent (no duplicate orders).

### 6.3 Settlement audit (optional)

- **File:** `lib/game/build-and-post-settlement.ts`
- **Findings:** It does **not** read or modify ShowcaseListing or its snapshots. It does **not** create or modify DailyProductSalesLog. It reads ModaverseOrder + ModaverseOrderItem (fulfilled qty, sale price), creates ModaverseSettlement + ModaverseSettlementLine, and posts ledger/wallet entries. It only consumes Step A/B outputs; no change needed.

---

## 7. Remaining Risks / Unknowns

- **Settlement:** Audited in §6.3; does not touch ShowcaseListing, DailyProductSalesLog, or Step A/B outputs.
- **Concurrency:** Mitigated by version-based clock update and 409 response (see §6.1).
- **Step A idempotency:** Logs are now always written for the day; order creation remains idempotent (see §6.2).
