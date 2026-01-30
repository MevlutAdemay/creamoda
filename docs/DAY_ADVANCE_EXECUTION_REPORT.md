# Day Advance Execution Report (ModaVerse Simulation)

**Scope:** Current implementation only. No code changes. Audit-style.

**Files in scope:**
- `app/api/player/advance-day/route.ts`
- `lib/game/advance-day.ts`
- `lib/game/run-warehouse-day-tick.ts`
- `lib/game/demand.ts` (getDesiredQty)
- `lib/game/build-and-post-settlement.ts`
- `lib/game/game-clock.ts` (getCompanyGameClock, normalizeUtcMidnight, isPayoutDay, getPeriodForPayoutDayKey, formatDayKeyString)
- `lib/finance/helpers.ts` (postLedgerEntryAndUpdateWallet, postLedgerEntry, updateWalletUsdFromLedger, generateIdempotencyKey)

---

## 1) High-level timeline

1. **HTTP POST** received at `app/api/player/advance-day/route.ts` → `POST()`.
2. **Auth:** `getServerSession()`; if no `session?.user?.id` → return 401 Unauthorized.
3. **Company lookup:** `prisma.company.findFirst({ where: { playerId: session.user.id }, select: { id: true } })`; if no company → return 404.
4. **advanceCompanyDay(companyId)** called (`lib/game/advance-day.ts`).
5. **Get clock:** `getCompanyGameClock(companyId)` → READ `CompanyGameClock` by `companyId` (or CREATE if missing with default start date). Returns `currentDayKey`, `startedAtDayKey`, `isPaused`, `version`.
6. **Compute new day:** `newDayKey = normalizeUtcMidnight(previousDayKey + 1 day)` (UTC).
7. **Get warehouses:** `prisma.companyBuilding.findMany({ where: { companyId, role: BuildingRole.WAREHOUSE }, select: { id: true } })`.
8. **Write clock:** `prisma.companyGameClock.update({ where: { companyId }, data: { currentDayKey: newDayKey, version: increment 1, lastAdvancedAt: now } })`. **Not inside a transaction** with tick/settlement.
9. **For each warehouse:** `runWarehouseDayTick(companyId, warehouseBuildingId, newDayKey)` (see §3). Count `warehousesTicked`.
10. **Branch – payout day:** If `isPayoutDay(newDayKey)` (UTC day of month === 5 or 20):
    - For each warehouse: `buildAndPostSettlement(companyId, warehouseBuildingId, newDayKey)` (see §4). If return non-null, increment `settlementsRun`.
11. **Return JSON:** `{ previousDayKey, newDayKey, warehousesTicked, settlementsRun }` (dayKeys formatted via `formatDayKeyString`). On throw → 500 with error message.

---

## 2) Per-step DB I/O table

| Step | Location | READ tables (filters) | WRITE tables | Idempotency / unique | Transaction |
|------|----------|------------------------|--------------|------------------------|-------------|
| 2–3 | advance-day/route.ts | Company (playerId) | — | — | No |
| 5 | game-clock.ts getCompanyGameClock | CompanyGameClock (companyId) | CompanyGameClock (create if missing) | companyId unique | No |
| 7 | advance-day.ts | CompanyBuilding (companyId, role WAREHOUSE) | — | — | No |
| 8 | advance-day.ts | — | CompanyGameClock (update currentDayKey, version, lastAdvancedAt) | companyId unique | No |
| 9 | runWarehouseDayTick (see §3) | ModaverseOrder, BuildingInventoryItem, ProductTemplate, ProductSalesBandConfig; then ModaverseOrderItem | ModaverseOrder, ModaverseOrderItem, BuildingInventoryItem, InventoryMovement; then ModaverseOrderItem (update) | ModaverseOrder: @@unique(warehouseBuildingId, dayKey) | Yes: single `prisma.$transaction` for entire tick |
| 10 | buildAndPostSettlement (see §4) | Company, ModaverseSettlement, ModaverseOrder+items, ProductTemplate; CompanyLedgerEntry (by idempotencyKey); PlayerWallet | ModaverseSettlement, ModaverseSettlementLine, CompanyLedgerEntry, PlayerWallet (balanceUsd increment), ModaverseSettlement (postedLedgerEntryId, postedAt) | Settlement: @@unique(companyId, warehouseBuildingId, periodStartDayKey, periodEndDayKey). Ledger: idempotencyKey unique. | Yes: single `prisma.$transaction` for entire settlement |

**Transaction boundaries:**
- **advance-day.ts:** No transaction. Clock is updated first; then each `runWarehouseDayTick` runs in its own transaction; then each `buildAndPostSettlement` runs in its own transaction.
- **runWarehouseDayTick:** One `prisma.$transaction` wrapping Step A (order generation) and Step B (fulfillment).
- **buildAndPostSettlement:** One `prisma.$transaction` wrapping settlement create, lines create, ledger+wallet post, settlement update.

---

## 3) Warehouse tick deep dive

**Entry:** `lib/game/run-warehouse-day-tick.ts` → `runWarehouseDayTick(companyId, warehouseBuildingId, dayKey)`.

All tick logic runs inside a single `prisma.$transaction(tx => { ... })`.

---

### Step A (Order generation)

- **Idempotency guard:** `tx.modaverseOrder.findUnique({ where: { warehouseBuildingId_dayKey: { warehouseBuildingId, dayKey: normalizedDayKey } }, include: { items: true } })`. If `existingOrder` exists → skip entire Step A (no order create, no inventory decrement, no movements).
- **Listings:** **Not used.** The current implementation does **not** read `ShowcaseListing`. Orders are generated from **warehouse inventory only** (BuildingInventoryItem). There is no filter by “listed” products or marketZone.
- **Inventory selection:** `tx.buildingInventoryItem.findMany({ where: { companyBuildingId: warehouseBuildingId, qtyOnHand: { gt: 0 }, isArchived: false }, select: { id, productTemplateId, playerProductId, qtyOnHand, avgUnitCost } })`. So: same warehouse, `qtyOnHand > 0`, `isArchived === false`.
- **Order create:** Single `tx.modaverseOrder.create({ data: { companyId, warehouseBuildingId, dayKey: normalizedDayKey } })`. No sortIndex or similar.
- **Per inventory item:**
  - **desiredQty:** `getDesiredQty(inv.productTemplateId, 0, tx)` (see §5). Tier is fixed `0`.
  - **orderedQty clamp:** `sellQty = Math.min(desired, inv.qtyOnHand)`. If `sellQty <= 0` → `continue` (no order item, no stock change, no movement).
  - **ProductTemplate read:** `tx.productTemplate.findUnique({ where: { id: inv.productTemplateId }, select: { suggestedSalePrice } })`. Used for `salePriceUsd` on order item (default 0 if missing).
  - **ModaverseOrderItem create:** `orderId, productTemplateId, playerProductId, qtyOrdered: sellQty, qtyFulfilled: 0, qtyShipped: 0, salePriceUsd`. **No sortIndex** in current schema/code.
  - **Stock decrement:** `tx.buildingInventoryItem.update({ where: { id: inv.id }, data: { qtyOnHand: { decrement: sellQty } } })`.
  - **InventoryMovement create:** `movementType: OUT`, `sourceType: SALES_ORDER`, `sourceRefId: order.id`, `qtyChange: sellQty` (positive), `unitCost: inv.avgUnitCost`, `dayKey: normalizedDayKey`. Convention: OUT + positive qtyChange = quantity leaving stock.
- **DailyProductSalesLog:** **Not read or written** in the tick. No qtyOrdered, no price snapshots, no listing linkage in this flow.
- **Listing auto-pause on out-of-stock:** **Not implemented.** No code touches ShowcaseListing when qtyOnHand becomes 0.

---

### Step B (Fulfillment)

- **Order fetch:** Same unique key: `tx.modaverseOrder.findUnique({ warehouseBuildingId_dayKey: { warehouseBuildingId, dayKey: normalizedDayKey } }, include: { items: true })`.
- **Capacity / BuildingMetricState / MetricLevelConfig:** **Not used.** There is no capacity limit; every unfulfilled item is fully “fulfilled” in one go.
- **FIFO / sortIndex:** No ordering by `order.dayKey` or `sortIndex`; the code simply iterates `order.items` and updates each where `qtyFulfilled < qtyOrdered`.
- **Updates:** For each item with `qtyFulfilled < qtyOrdered`: `tx.modaverseOrderItem.update({ where: { id: item.id }, data: { qtyFulfilled: item.qtyOrdered, qtyShipped: item.qtyOrdered } })`. So fulfillment sets both to `qtyOrdered` in one step.
- **Stock / movements:** Step B does **not** change BuildingInventoryItem or create InventoryMovement. Only ModaverseOrderItem rows are updated.
- **qtyShipped:** Set in the same update as `qtyFulfilled` (see above); no separate “shipment” step.

---

## 4) Settlement deep dive (only when payout day)

**Entry:** `lib/game/build-and-post-settlement.ts` → `buildAndPostSettlement(companyId, warehouseBuildingId, payoutDayKey)`.

- **Payout day detection:** Done in `advance-day.ts`: `isPayoutDay(newDayKey)` (`lib/game/game-clock.ts`). Implementation: `normalizeUtcMidnight(dayKey)` then `day === 5 || day === 20` (UTC day of month).
- **Period calculation:** `getPeriodForPayoutDayKey(payoutDayKey)` in game-clock.ts:
  - If UTC day === 5: `periodStartDayKey` = previous month 20th (incl.), `periodEndDayKey` = current month 4th (incl.).
  - If UTC day === 20: `periodStartDayKey` = current month 5th (incl.), `periodEndDayKey` = current month 19th (incl.).
  - Otherwise returns `null` → `buildAndPostSettlement` returns `null` (no settlement).
- **Data source for aggregation:** **ModaverseOrder + ModaverseOrderItem** only. Query: `tx.modaverseOrder.findMany({ where: { warehouseBuildingId, companyId, dayKey: { gte: periodStartDayKey, lte: periodEndDayKey } }, include: { items: true } })`. **DailyProductSalesLog is not used.** Grouping key: `productTemplateId` (aggregated in a Map: fulfilledQty sum, grossRevenueUsd sum, salePriceUsd last, listingId last).
- **Tier / PlatformTierConfig / 7d avg:** **Not implemented.** No tier snapshot, no tier-based fees.
- **Commission / logistics / returns:**
  - Commission: `COMMISSION_RATE = 0.10` (10%); `commissionFeeUsd = grossRevenueUsd * COMMISSION_RATE`.
  - Logistics: `logisticsUnitFeeUsd = 0`, `logisticsFeeUsd = logisticsUnitFeeUsd * fulfilledQty` (= 0).
  - Returns: `returnRateSnapshot = 0`, `returnQty = 0`, `returnDeductionUsd = 0`.
  - Line: `netRevenueUsd = grossRevenueUsd - commissionFeeUsd - logisticsFeeUsd - returnDeductionUsd`.
- **ModaverseSettlementLine:** Explicit columns only (no generic JSON): tierSnapshot/logisticsCountryFactor not set (optional in schema). shippingProfileSnapshot from ProductTemplate or DEFAULT_SHIPPING_PROFILE (MEDIUM).
- **Ledger and linkage:** Inside the same transaction: `postLedgerEntryAndUpdateWallet(tx, company.playerId, ledgerPayload)` → creates `CompanyLedgerEntry` (idempotencyKey), then `updateWalletUsdFromLedger` → `PlayerWallet.balanceUsd` increment (only if entry is new). Then `tx.modaverseSettlement.update({ where: { id: settlement.id }, data: { postedLedgerEntryId: ledgerResult.entry.id, postedAt: new Date() } })`.
- **Idempotency:** Settlement: `findUnique` on `companyId_warehouseBuildingId_periodStartDayKey_periodEndDayKey`. If exists → return existing result and exit (no new settlement/lines/ledger). Ledger: `postLedgerEntry` uses `idempotencyKey` (unique); duplicate key → return existing entry, wallet not updated again.

---

## 5) Why sales can happen even without full multiplier model

- **Current demand (stub):** `lib/game/demand.ts` → `getDesiredQty(productTemplateId, tier, tx)`:
  - **Inputs:** productTemplateId, tier (fixed 0 in tick), optional tx.
  - **Algorithm:**  
    1. Load ProductTemplate (categoryL3Id, productQuality). If not found → return 0.  
    2. Load ProductSalesBandConfig: categoryL3Id, productQuality, isActive: true, tierMin ≤ tier ≤ tierMax.  
    3. If no band: base = 1, return `max(0, round(1 + jitter(1)))` (jitter ±15%).  
    4. If band: base = expectedMode ?? round((minDaily + maxDaily) / 2); potentialMultiplier = 1.0; withJitter = base * 1.0 + jitter(base); return max(0, round(withJitter)).
  - **Jitter:** `(Math.random() * 2 - 1) * (value * 0.15)` — not seeded; non-deterministic.
- **Not implemented (no effect on current sales):** Seasonality curves, pricing index, traffic/visitors, bots tuning, marketZone/listing-based demand, PlatformTierConfig, any “multiplier” beyond 1.0.
- **When desiredQty becomes 0 (or no order line):**
  - Template missing → getDesiredQty returns 0 → sellQty = min(0, qtyOnHand) = 0 → row skipped (no order item).
  - Band missing → base 1 + jitter can still be &gt; 0; only if round(...) ≤ 0 after jitter would result be 0.
  - Band with expectedMode/min/max such that base is 0 and jitter doesn’t push it above 0 → possible but rare.
  - In tick: `sellQty <= 0` → skip (no listing check; inventory with qtyOnHand &gt; 0 is still the only gate besides desiredQty).

---

## 6) Gaps / TODO (factual, from code)

- **ShowcaseListing not used in tick**  
  Order generation uses only BuildingInventoryItem (warehouse + qtyOnHand &gt; 0). No filter by ShowcaseListing (status LISTED, marketZone, etc.). So “sales” can occur for any product in stock at the warehouse, not only showcased products.  
  **Where to address:** `lib/game/run-warehouse-day-tick.ts` (Step A): add join/filter by ShowcaseListing (e.g. status LISTED, warehouseBuildingId, and optionally marketZone) so only listed products generate order lines.

- **DailyProductSalesLog never written**  
  Tick does not create or update DailyProductSalesLog (qtyOrdered, price snapshots, listingId, etc.). Settlement aggregates from ModaverseOrder/ModaverseOrderItem only.  
  **Where to address:** `lib/game/run-warehouse-day-tick.ts` (Step A or B): create/update DailyProductSalesLog rows when orders are generated or fulfilled, if that is the agreed source of truth for reporting/settlement.

- **No out-of-stock listing auto-pause/delist**  
  When qtyOnHand becomes 0 (after order generation or elsewhere), ShowcaseListing is not updated (e.g. status PAUSED, pausedReason OUT_OF_STOCK).  
  **Where to address:** e.g. `lib/game/run-warehouse-day-tick.ts` after stock decrement, or a separate job: update ShowcaseListing for (playerProductId, warehouse, marketZone) when corresponding BuildingInventoryItem.qtyOnHand becomes 0.

- **Settlement line/header snapshot completeness**  
  tierSnapshot, logisticsCountryFactor, and real logistics/return formulas are not implemented; commission is fixed 10%, logistics/returns are 0.  
  **Where to address:** `lib/game/build-and-post-settlement.ts`: tier from PlatformTierConfig (or equivalent), logistics/return rules, and snapshot fields per agreed design.

- **Deterministic jitter**  
  `getDesiredQty` uses `Math.random()` with no seed. Re-running the same day can yield different desiredQty.  
  **Where to address:** `lib/game/demand.ts` `jitter()`: accept or use a seeded RNG (e.g. from companyId + warehouseId + dayKey + productTemplateId) so same inputs give same desiredQty.

- **No capacity / BuildingMetricState / MetricLevelConfig in fulfillment**  
  Step B fulfills all unfulfilled items fully; no capacity limit or metric-based cap.  
  **Where to address:** `lib/game/run-warehouse-day-tick.ts` (Step B): compute capacity from BuildingMetricState + MetricLevelConfig (or equivalent), apply FIFO/sortIndex, cap qtyFulfilled/qtyShipped by capacity.

- **ModaverseOrderItem has no sortIndex**  
  Schema/code do not define or use sortIndex for FIFO ordering of items.  
  **Where to address:** Schema + `lib/game/run-warehouse-day-tick.ts`: add sortIndex on create and use it in fulfillment ordering if FIFO is required.

---

## Mismatch summary (agreed vs implemented)

- **Listings:** Agreed that only listed products (ShowcaseListing) should sell. **Implemented:** All warehouse inventory with qtyOnHand &gt; 0 can generate orders; ShowcaseListing is not read in the tick.
- **Settlement data source:** If settlement was agreed to be driven by DailyProductSalesLog (e.g. for audit/reporting), **implemented** uses only ModaverseOrder/ModaverseOrderItem.
- **Out-of-stock:** Agreed auto-pause/delist when stock hits 0. **Implemented:** No ShowcaseListing update when qtyOnHand goes to 0.

All other behaviors (clock advance, warehouse tick idempotency, stock-out at order creation, fulfillment without stock/movements, settlement period 5th/20th, ledger linkage postedLedgerEntryId/postedAt, demand from band + jitter) match the described design for the current stub.
