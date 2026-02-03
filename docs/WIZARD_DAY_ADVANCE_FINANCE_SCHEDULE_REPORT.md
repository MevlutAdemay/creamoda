# Wizard + Day Advance + Finance Schedule — Mevcut Sistem Raporu

**Amaç:** CreateCompany (Wizard), dayKey ilerlemesi ve payout/payroll/rent/overhead akışının mevcut durumunun net raporu. Yeni mekanik önerilmedi; sadece “mevcut olan ne yapıyor” çıkarıldı.

---

## 0) Çıktı formatı

Rapor aşağıdaki başlıklarda verilmiştir; her başlık altında bulgular madde madde ve dosya yollarıyla belirtilmiştir.

---

## 1) CreateCompany / Wizard Akışı

### Wizard hangi endpoint’i çağırıyor?

- **Adım 1 (şirket oluşturma):** `POST /api/wizard/company`  
  - Dosya: `app/api/wizard/company/route.ts`  
  - Body: `{ companyName, countryId, cityId }` (CreateCompanyBody).

- **Adım 3 (kurulum tamamlama):** `POST /api/wizard/process`  
  - Dosya: `app/api/wizard/process/route.ts`  
  - Body yok; session’dan `userId` ve company alınır.

### CreateCompany (POST /api/wizard/company) hangi tabloları create ediyor?

- **Company** — `tx.company.create()` (yeni şirket) veya `tx.company.update()` (mevcut güncelleme).  
  `app/api/wizard/company/route.ts` satır 145–156 (create), 112–124 (update).
- **PlayerWallet** — `tx.playerWallet.upsert()` (create: balanceUsd 100000, balanceXp/balanceDiamond 0).  
  Aynı dosya satır 159–168.
- **CompanyBuilding** — Doğrudan bu route’da create edilmiyor; `ensureCompanyBuildings(tx, …)` çağrılıyor (aşağıda).

Oluşturulmayan / atlanan:

- **CompanyGameClock** — CreateCompany’de yok; Process step’te oluşturuluyor.
- **CompanyStaff** — CreateCompany’de yok; Process step’te atanıyor.
- **FinanceScheduleConfig** — Hiçbir wizard endpoint’inde create edilmiyor.
- **BuildingMetricState** — CreateCompany’de yok; Process step’te `initBuildingMetrics` ile oluşturuluyor.

### ensureCompanyBuildings (CreateCompany ve Process’te ortak)

- **Dosya:** `lib/company/ensure-company-buildings.ts`
- **Fonksiyon:** `ensureCompanyBuildings(tx, { companyId, countryId })`
- **Tablolar:** Sadece **CompanyBuilding**:
  - HQ: `findFirst` yoksa `companyBuilding.create` (role HQ, name 'Headquarters').
  - WAREHOUSE: aynı şekilde `findFirst` yoksa `create` (role WAREHOUSE, marketZone ülkeden).
- **Transaction:** Çağıran tarafında (wizard company veya process) `prisma.$transaction` içinde çağrılıyor.

### Wizard Process (POST /api/wizard/process) hangi tabloları create/güncelliyor?

Tek bir `prisma.$transaction` içinde sıra:

1. **CompanyGameClock** — `tx.companyGameClock.upsert` (currentDayKey = DEFAULT_GAME_START_DATE = 2025-09-10).  
   `app/api/wizard/process/route.ts` satır 131–140.
2. **CompanyBuilding** — `ensureCompanyBuildings(tx, …)` (HQ + WAREHOUSE).
3. **BuildingMetricState** — `initBuildingMetrics(tx, hqBuilding)` ve `initBuildingMetrics(tx, warehouseBuilding)` (MetricLevelConfig + EconomyConfig’e göre upsert; rentPerMonthly/overheadMonthly burada set ediliyor).  
   `lib/buildings/init-building-metrics.ts`.
4. **CompanyLedgerEntry** — `postBuildingSetupCosts` (WIZARD_SETUP refType, CAPEX) ve equipment için `postLedgerEntry` (WIZARD_EQUIPMENT, WIZARD_CAPEX).
5. **CompanyStaff** — `assignStaffForBuilding` (HQ ve Warehouse için StaffingRule’a göre; monthlySalaryFinal, hiredAt = dayKey).
6. **CompanyEquipment** — `assignEquipmentForBuilding` (RequirementRule’a göre upsert).
7. **PlayerWallet** — `updateWalletUsdFromLedgerBatch` ile USD güncelleme; `postWalletTransactionAndUpdateBalance` ile XP (WIZARD_COMPLETION).
8. **User** — `onboardingStatus = DONE`, `onboardingStep = null`, `onboardingCompletedAt = now()`.

Oluşturulmayan:

- **FinanceScheduleConfig** — Process’te de create/upsert yok.

### Oluşturma sırası ve transaction

- **Company route:** Tek `prisma.$transaction` içinde: company create/update → wallet upsert → ensureCompanyBuildings → user update.  
  `app/api/wizard/company/route.ts` satır 100–186.
- **Process route:** Tek `prisma.$transaction` (timeout 90000 ms): GameClock → ensureCompanyBuildings → initBuildingMetrics → setup ledger → staff → equipment → wallet update → XP → user update.  
  `app/api/wizard/process/route.ts` satır 126–245.

### Wizard bitince player ilk güne nasıl başlıyor (dayKey initial)?

- **Company** adımında clock yok; ilk gün set edilmez.
- **Process** adımında `CompanyGameClock.upsert` ile `currentDayKey = DEFAULT_GAME_START_DATE` (`2025-09-10T00:00:00.000Z`).  
  `lib/game/game-clock.ts`: `DEFAULT_GAME_START_DATE`; Process’te `normalizeUtcMidnight(DEFAULT_GAME_START_DATE)` kullanılıyor.
- Yani dayKey initial: Process tamamlanınca **2025-09-10 (UTC midnight)**.

---

## 2) Day Advance Akışı (advanceCompanyDay)

### advanceCompanyDay(companyId) kim çağırıyor?

- **API:** `POST /api/player/advance-day`  
  Dosya: `app/api/player/advance-day/route.ts`.  
  Session’dan company alınır, `advanceCompanyDay(company.id)` çağrılır.

### Akış sırası (lib/game/advance-day.ts)

1. **Clock read** — `getCompanyGameClock(companyId)` (`lib/game/game-clock.ts`). Yoksa create (DEFAULT_GAME_START_DATE).
2. **previousDayKey / newDayKey** — `previousDayKey = clock.currentDayKey`, `nextDay.setUTCDate(nextDay.getUTCDate() + 1)`, `newDayKey = normalizeUtcMidnight(nextDay)`.
3. **Warehouses list** — `prisma.companyBuilding.findMany({ where: { companyId, role: WAREHOUSE } })`.
4. **version updateMany** — `prisma.companyGameClock.updateMany({ where: { companyId, version: clock.version }, data: { currentDayKey: newDayKey, version: clock.version + 1, lastAdvancedAt: new Date() } })`.  
  `updated.count === 0` ise `ADVANCE_DAY_CONCURRENT` fırlatılır (concurrent advance koruması).
5. **runWarehouseDayTick** — Her warehouse için `runWarehouseDayTick(companyId, wh.id, newDayKey)` (sırayla, transaction’lar warehouse başına).
6. **isPayoutDay(newDayKey)** — `lib/game/game-clock.ts` içinde `isPayoutDay(dayKey)`: `day === 5 || day === 20` (UTC günü). **FinanceScheduleConfig okunmuyor; sabit 5 ve 20.**
7. **buildAndPostSettlement** — Sadece `isPayoutDay` true ise her warehouse için `buildAndPostSettlement(companyId, wh.id, newDayKey)`.

### DayKey “ayın kaçıncı günü” kontrolü nerede yapılıyor?

- **Payout günü:** `lib/game/game-clock.ts` içinde `isPayoutDay(dayKey)`: `normalizeUtcMidnight(dayKey).getUTCDate()` ile sadece 5 ve 20 kontrol edilir.  
  Ayın günü için başka bir kontrol (örn. payroll 1, rent 15) advance-day veya başka bir modülde **yapılmıyor**.

### Günlük işlemlerde “ledger entry” yazımı nerelerde?

- **Payout (5/20):** `lib/game/build-and-post-settlement.ts` — settlement sonrası `postLedgerEntryAndUpdateWallet` ile GROSS, COMMISSION, LOGISTICS, RETURNS (refType `MODAVERSE_SETTLEMENT`).
- **Marketing:** Campaign POST’larında (warehouse/category/product) `postLedgerEntryAndUpdateWallet` (FinanceCategory.MARKETING, OUT).
- **Wizard:** Process içinde setup/equipment için `postLedgerEntry` + `updateWalletUsdFromLedgerBatch`.
- **Fast supply:** `app/api/player/fast-supply-purchase/route.ts` içinde `postLedgerEntryAndUpdateWallet`.

Payroll / rent / overhead için ledger yazan **hiçbir günlük akış yok**.

---

## 3) Mevcut Payout (5/20) Nasıl Çalışıyor?

### isPayoutDay(newDayKey) nerede, nasıl hesaplanıyor?

- **Dosya:** `lib/game/game-clock.ts`
- **Fonksiyon:** `isPayoutDay(dayKey: Date): boolean`
- **Mantık:** `normalizeUtcMidnight(dayKey)`; `day = normalized.getUTCDate()`; `return day === 5 || day === 20`.
- **Schedule kaynağı:** FinanceScheduleConfig kullanılmıyor; **hardcoded 5 ve 20**.

### buildAndPostSettlement

- **Dosya:** `lib/game/build-and-post-settlement.ts`
- **Ledger refType:** `MODAVERSE_SETTLEMENT` (refId = settlement.id).  
  Ayrıca GROSS (IN), COMMISSION, LOGISTICS, RETURNS (OUT) için ayrı entry’ler; hepsi aynı refType/refId.
- **Wallet güncellemesi:** `postLedgerEntryAndUpdateWallet(tx, company.playerId, payload)` (`lib/finance/helpers.ts`).  
  Önce `postLedgerEntry` (idempotencyKey ile upsert), sonra `updateWalletUsdFromLedger` (sadece isNew ise balanceUsd increment).
- **IdempotencyKey:** Kullanılıyor. Her entry için:  
  `MODAVERSE_SETTLEMENT:GROSS:${settlement.id}`, `...:COMMISSION:...`, `...:LOGISTICS:...`, `...:RETURNS:...`.  
  Settlement zaten unique (companyId, warehouseBuildingId, periodStartDayKey, periodEndDayKey); aynı period’ta tekrar çağrıda settlement bulunur, yeni ledger yazılmaz (settlement create edilmediği için yeni entry’ler de üretilmez).

---

## 4) Payroll / Rent / Overhead Neden Çalışmıyor?

- **advanceCompanyDay** ve **runWarehouseDayTick** içinde payroll, rent veya overhead için **hiçbir kontrol ve ledger/wallet işlemi yok**.
- **isPayoutDay** sadece 5 ve 20’yi tetikliyor; ayın 1’i (payroll) veya 15’i (rent/overhead) için tetikleyici yok.
- Sonuç: Veriler (staff maaşı, bina kira/overhead) var ama **günlük akışta bu verileri okuyup ledger/wallet güncelleyen kod yok**.

### CompanyStaff maaş alanı

- **Alan:** `monthlySalaryFinal` (Decimal).  
  `prisma/schema.prisma` model `CompanyStaff` satır 1021.  
  Ayrıca `baseMonthlySalary`, `salaryMultiplierApplied` var; wizard’da `monthlySalaryFinal = baseSalary * salaryMultiplier` set ediliyor (`app/api/wizard/process/route.ts` assignStaffForBuilding içinde).

### rentPerMonthly ve overheadMonthly nerede duruyor?

- **BuildingMetricState** içinde: `rentPerMonthly`, `overheadMonthly` (Decimal?, nullable).  
  `prisma/schema.prisma` model `BuildingMetricState` satır 972–973.
- **Doldurulma:** `lib/buildings/init-building-metrics.ts` — `EconomyConfig`’ten (buildingRole, level 1, metricType) alınıp her `BuildingMetricState` upsert’inde `rentPerMonthly` ve `overheadMonthly` set ediliyor.  
  MetricType başına bir row; yani **rent/overhead hangi metricType row’unda** EconomyConfig’te tanımlıysa o row’da dolu (örn. EMPLOYEE_COUNT veya başka bir metric için config’te varsa orada).
- **EconomyConfig** (schema): `buildingRole`, `level`, `metricType`, `rentPerMonthly`, `overheadMonthly` (opsiyonel).  
  Yani kaynak **template/config** tablosu EconomyConfig; runtime değer BuildingMetricState’te.

Özet: Payroll için `CompanyStaff.monthlySalaryFinal` kullanılabilir; rent/overhead için `BuildingMetricState.rentPerMonthly` / `overheadMonthly` ve EconomyConfig mevcut. Sadece **advance gününde bu verileri okuyup ledger/wallet’a yazan adım yok**.

---

## 5) FinanceScheduleConfig raporu

- **Tabloda var;** `prisma/schema.prisma` model `FinanceScheduleConfig`:  
  `payrollDayOfMonth` (default 1), `rentDayOfMonth` (15), `overheadDayOfMonth` (15), `payoutDayOfMonth1` (5), `payoutDayOfMonth2` (20).
- **Kodda okunmuyor:**  
  `FinanceScheduleConfig` veya `financeScheduleConfig` araması: sadece schema, relation ve `scripts/seed-finance-schedule-config.ts` çıkıyor.  
  advance-day, game-clock, build-and-post-settlement **hiçbirinde** bu tablo okunmuyor.
- **CreateCompany / Process:** FinanceScheduleConfig create edilmiyor; wizard sonrası şirket için row **yok** (seed script ayrı çalıştırılırsa var).
- **Payout günleri:** `lib/game/game-clock.ts` içinde **hardcoded** `day === 5 || day === 20`.  
  Varsayılan değerler (1, 15, 15, 5, 20) sadece seed script’te (`scripts/seed-finance-schedule-config.ts`).

---

## 6) Eksik olan minimum ekleme noktası(ları)

- **CreateCompany / Wizard tarafı:**  
  Şirket ilk kez oluşturulduğunda veya Process tamamlandığında **FinanceScheduleConfig** için bir row yok.  
  **Minimum ekleme:**  
  - Ya `app/api/wizard/company/route.ts` transaction içinde company create’ten sonra (veya mevcut company path’te),  
  - Ya da **tercihen** `app/api/wizard/process/route.ts` transaction içinde (GameClock’tan hemen sonra veya buildings’den sonra)  
  `FinanceScheduleConfig` için `tx.financeScheduleConfig.upsert({ where: { companyId }, create: { companyId, payrollDayOfMonth: 1, rentDayOfMonth: 15, overheadDayOfMonth: 15, payoutDayOfMonth1: 5, payoutDayOfMonth2: 20 }, update: {} })` eklenmeli.  
  Böylece her şirket için varsayılan schedule tek yerde ve idempotent kalır.

- **advanceCompanyDay tarafı:**  
  Ayın 1’i ve 15’i için tetikleyici ve ledger/wallet yok.  
  **Minimum ekleme:**  
  - `lib/game/advance-day.ts` içinde, clock update ve warehouse tick’lerden sonra, `isPayoutDay` bloğundan önce (veya sonra) bir blok eklenmeli:  
    - `newDayKey`’in ayın günü (getUTCDate()) alınsın.  
    - İsteğe bağlı: Company’nin `FinanceScheduleConfig`’i oku (yoksa default 1, 15, 15 kullan).  
    - **Gün === payrollDayOfMonth (örn. 1)** ise: payroll mantığı (company’deki tüm active staff’ın `monthlySalaryFinal` toplamı → tek OUT ledger entry + wallet decrement), idempotencyKey örn. `PAYROLL:${companyId}:${YYYY-MM-DD}`.  
    - **Gün === rentDayOfMonth veya overheadDayOfMonth (örn. 15)** ise: her building için BuildingMetricState’ten `rentPerMonthly` / `overheadMonthly` topla (veya building bazlı ayrı entry), OUT ledger + wallet decrement; idempotencyKey örn. `RENT:${companyId}:${buildingId}:${YYYY-MM}` ve `OVERHEAD:...`.  
  - Veri kaynağı: Mevcut tablolar (CompanyStaff.monthlySalaryFinal, BuildingMetricState.rentPerMonthly/overheadMonthly); FinanceScheduleConfig sadece hangi günde tetikleneceğini belirlemek için (opsiyonel, yoksa hardcode 1 ve 15).

Özet: (1) Wizard’da (tercihen Process) **FinanceScheduleConfig** create/upsert. (2) advanceCompanyDay içinde **ayın gününe göre payroll (1) ve rent/overhead (15)** için mevcut tablolardan okuyup ledger + wallet güncelleyen minimum kod.

---

## 7) İlgili Dosyalar ve Fonksiyon İmzaları

| Konu | Dosya | Fonksiyon / Not |
|------|--------|------------------|
| Wizard company create | `app/api/wizard/company/route.ts` | `POST`, `CreateCompanyBody`, `ensureCompanyBuildings` |
| Wizard process | `app/api/wizard/process/route.ts` | `POST`, `initBuildingMetrics`, `assignStaffForBuilding`, `assignEquipmentForBuilding`, `postBuildingSetupCosts` |
| Buildings ensure | `lib/company/ensure-company-buildings.ts` | `ensureCompanyBuildings(tx, { companyId, countryId })` |
| Building metrics init | `lib/buildings/init-building-metrics.ts` | `initBuildingMetrics(tx, building)`, `getBuildingSetupCosts(tx, buildingRole)` |
| Advance day API | `app/api/player/advance-day/route.ts` | `POST`, `advanceCompanyDay(company.id)` |
| Advance day logic | `lib/game/advance-day.ts` | `advanceCompanyDay(companyId): Promise<AdvanceCompanyDayResult>` |
| Game clock | `lib/game/game-clock.ts` | `getCompanyGameClock(companyId)`, `normalizeUtcMidnight`, `isPayoutDay(dayKey)`, `getPeriodForPayoutDayKey(payoutDayKey)` |
| Warehouse tick | `lib/game/run-warehouse-day-tick.ts` | `runWarehouseDayTick(companyId, warehouseBuildingId, dayKey)` |
| Settlement + ledger | `lib/game/build-and-post-settlement.ts` | `buildAndPostSettlement(companyId, warehouseBuildingId, payoutDayKey)` |
| Finance helpers | `lib/finance/helpers.ts` | `postLedgerEntry(tx, payload)`, `postLedgerEntryAndUpdateWallet(tx, userId, payload)`, `updateWalletUsdFromLedger`, `updateWalletUsdFromLedgerBatch` |
| Finance schedule seed | `scripts/seed-finance-schedule-config.ts` | Defaults: payroll 1, rent 15, overhead 15, payout 5 & 20 |

---

## 8) DB Tablo ve Alan Haritası (ilgili kısım)

| Tablo | İlgili alanlar | Kullanım |
|-------|-----------------|----------|
| Company | id, playerId, name, countryId, cityId | Wizard create; advance-day’de company bulunur. |
| CompanyGameClock | companyId, currentDayKey, startedAtDayKey, version, lastAdvancedAt | Process’te upsert; advance-day’de read + updateMany (version ile). |
| PlayerWallet | userId, balanceUsd, balanceXp, balanceDiamond | Wizard’da upsert; payout/marketing/wizard setup’ta increment. |
| CompanyBuilding | id, companyId, role (HQ/WAREHOUSE), countryId, marketZone | ensureCompanyBuildings ile create; advance-day’de warehouse listesi. |
| BuildingMetricState | buildingId, metricType, currentLevel, currentCount, areaM2, rentPerMonthly, overheadMonthly | initBuildingMetrics ile doldurulur; rent/overhead burada ama advance’da okunmuyor. |
| CompanyStaff | companyId, buildingId, metricType, level, monthlySalaryFinal, hiredAt, firedAt | Wizard’da create; payroll için kullanılabilir ama advance’da kullanılmıyor. |
| FinanceScheduleConfig | companyId, payrollDayOfMonth, rentDayOfMonth, overheadDayOfMonth, payoutDayOfMonth1, payoutDayOfMonth2 | Seed script’te var; wizard’da create yok; advance’da okunmuyor. |
| CompanyLedgerEntry | companyId, dayKey, direction, amountUsd, category, scopeType, scopeId, refType, refId, idempotencyKey | Payout, marketing, wizard setup, fast-supply tarafından create. |
| ModaverseSettlement | companyId, warehouseBuildingId, periodStartDayKey, periodEndDayKey, payoutDayKey | buildAndPostSettlement içinde; unique constraint ile idempotency. |
| EconomyConfig | buildingRole, level, metricType, rentPerMonthly, overheadMonthly, areaM2, upgradeCostMoney | initBuildingMetrics’te okunur; BuildingMetricState’e kopyalanır. |

---

## 9) Idempotency / Double-run riskleri

- **advanceCompanyDay:**  
  - **Clock:** `updateMany({ where: { companyId, version: clock.version } })`; count 0 ise `ADVANCE_DAY_CONCURRENT` atılır. Aynı version ile iki eşzamanlı advance’da biri 0 row günceller, tek ilerleme garantisi var.  
  - **Warehouse tick:** ModaverseOrder `warehouseBuildingId_dayKey` unique; aynı gün tekrar tick aynı order’ı kullanır / tekrar create etmez.  
  - **Settlement:** `ModaverseSettlement` unique (companyId, warehouseBuildingId, periodStartDayKey, periodEndDayKey); aynı period’ta ikinci çağrıda settlement bulunur, yeni create yok; ledger tarafı da settlement create edilmediği için yeni entry üretilmez (idempotencyKey’ler settlement.id’ye bağlı).  
- **Ledger:** `postLedgerEntry` / `postLedgerEntryAndUpdateWallet` idempotencyKey ile önce findUnique; varsa create yok, wallet güncellemesi de isNew ise yapılıyor.  
- **Risk:** advanceCompanyDay’in kendisi transaction değil; clock update ile warehouse tick’ler ve settlement çağrıları ayrı. Clock güncellendikten sonra hata olursa gün ilerlemiş olur ama tick/settlement yarım kalabilir. Bu “double advance” değil, “partial advance” riski.  
- **Payroll/rent/overhead:** Henüz tetiklenmediği için bu akışlarda double-run değerlendirmesi yok; eklenirken idempotencyKey (örn. PAYROLL:companyId:YYYY-MM-DD) kullanılmalı.

---

## 10) Sonuç

- **Payroll ve overhead neden şu an çalışmıyor?**  
  Çünkü advanceCompanyDay (ve tüm günlük akış) sadece warehouse tick ve ayın 5/20 payout’unu çalıştırıyor; ayın 1’i (payroll) ve ayın 15’i (rent/overhead) için tarih kontrolü ve bu tarihlerde CompanyStaff / BuildingMetricState’ten okuyup ledger ve wallet güncelleyen kod yok.

- **En az hangi iki noktaya ekleme şart?**  
  1) **CreateCompany / Wizard:** Process transaction’ında (tercihen GameClock’tan hemen sonra) `FinanceScheduleConfig` için bir `upsert` (companyId, varsayılan günler).  
  2) **advanceCompanyDay:** `newDayKey`’in ayın gününe göre payroll (örn. 1) ve rent/overhead (örn. 15) tetikleyen blok; mevcut tablolardan (CompanyStaff.monthlySalaryFinal, BuildingMetricState.rentPerMonthly/overheadMonthly) okuyup ledger + wallet güncellemesi; idempotencyKey ile tekrar çalıştırmada çift ödeme önlenmeli.
