# Advance-Day Detay Raporu

Bu rapor, oyunda **DayKey +1** (gün ilerletme) yapıldığında tetiklenen tüm süreçleri açıklar: satış hesaplama, stok düşümü, sipariş oluşturma, backlog (bekleyen sipariş) işleme ve ödemeler.

---

## 1. Giriş Noktası

- **API:** `POST /api/player/advance-day`
- **Kod:** `app/api/player/advance-day/route.ts`
- **Ana fonksiyon:** `advanceCompanyDay(companyId)` — `lib/game/advance-day.ts`

Kimlik doğrulama ve şirket kontrolünden sonra tek bir `advanceCompanyDay(company.id)` çağrısı yapılır.

---

## 2. advanceCompanyDay Genel Akış

`lib/game/advance-day.ts` sırasıyla şunları yapar:

1. **Saat güncellemesi (optimistic lock)**  
   - `CompanyGameClock` okunur (`currentDayKey`, `version`).  
   - Yeni gün: `nextDay = previousDayKey + 1 gün` (UTC midnight).  
   - `updateMany` ile `currentDayKey = newDayKey`, `version = version + 1`, `lastAdvancedAt = now`.  
   - `updated.count === 0` ise eşzamanlı ilerletme varsayılır → **ADVANCE_DAY_CONCURRENT** hatası fırlatılır.

2. **Her depo için warehouse day tick**  
   - Şirketin tüm `CompanyBuilding` (role=WAREHOUSE) kayıtları alınır.  
   - Her biri için `runWarehouseDayTick(companyId, warehouseBuildingId, newDayKey)` çağrılır.

3. **Planlanmış maliyetler**  
   - `postScheduledCompanyCosts(companyId, newDayKey)` — o güne ait ayın gününe göre maaş / kira / genel gider (varsa) ledger’a yazılır.

4. **Ödeme günü ise settlement**  
   - `isPayoutDayForCompany(companyId, newDayKey)` ile o günün 5. veya 20. (veya şirket ayarlarındaki payout günleri) olup olmadığı kontrol edilir.  
   - Ödeme günüyse her depo için `buildAndPostSettlement(companyId, warehouseBuildingId, newDayKey)` çalıştırılır.

Aşağıda bu adımların her biri detaylı açıklanıyor.

---

## 3. runWarehouseDayTick — Satış, Sipariş ve Stok

**Dosya:** `lib/game/run-warehouse-day-tick.ts`

Tek bir depo ve tek bir `dayKey` için çalışır. **Tek bir transaction** içinde iki adım vardır: **Step A (sipariş oluşturma)** ve **Step B (backlog’dan sevkiyat / stok düşümü)**.

### 3.1 Tick Öncesi: Marketing Güncellemesi

Sipariş hesaplamadan önce, o gün için geçerli kampanyalar listeleme üzerine yansıtılır (listing’ler güncellenir; fiyat/band/season değiştirilmez):

1. **applyWarehouseMarketing**  
   - Depo + `dayKey` için aktif `WarehouseMarketingCampaign` kayıtları toplanır.  
   - Toplam `positiveBoostPct` / `negativeBoostPct` hesaplanıp tüm LISTED listing’lere yazılır.

2. **applyCategoryMarketing**  
   - Önce warehouse boost’u baz alınır; sonra aktif `CategoryMarketingCampaign` ile kategori (L2) bazlı boost eklenir.  
   - İlgili listing’lerin `positiveBoostPct` / `negativeBoostPct` alanları güncellenir.

3. **applyProductMarketing**  
   - Aktif `ProductMarketingCampaign` ile ürün/listing bazlı boost eklenir.  
   - Yine sadece boost yüzdeleri güncellenir.

Bu üçü, Step A’da okunan listing snapshot’ındaki talep çarpanlarını belirler.

---

### 3.2 Step A: Sipariş (Talep) Oluşturma

**Amaç:** O gün için “sipariş edilen miktar”ı (orderedQty) hesaplamak, günlük satış log’unu yazmak ve **sadece ilk kez** bu (depo, dayKey) için bir `ModaverseOrder` + satırları oluşturmak. **Stok bu adımda düşürülmez.**

#### Idempotency

- `ModaverseOrder` için unique key: `(warehouseBuildingId, dayKey)`.  
- Bu (depo, gün) için sipariş zaten varsa Step A’da sadece **DailyProductSalesLog** upsert edilir; yeni sipariş/satır oluşturulmaz.

#### Veri Kaynakları

- **Listing’ler:** `ShowcaseListing` — `companyId`, `warehouseBuildingId`, `status = LISTED`.  
- **Stok:** `BuildingInventoryItem` — aynı depo, ilgili `productTemplateId`’ler, `qtyOnHand`, `avgUnitCost`.

#### Talep (orderedQty) Hesaplama (Her Listing İçin)

1. **Temel talep**  
   - `baseDesired = listing.baseQty ?? 0`  
   - `expectedUnits = baseDesired`

2. **Marketing çarpanları**  
   - `positiveBoostPct`, `negativeBoostPct` (warehouse/category/product ile güncellenmiş):  
     - `unitsAfterBoost = expectedUnits * (1 + posPct/100) * (1 - negPct/100)`  
   - `priceMultiplier` (listing’te; fiyat bandı etkisi):  
     - `unitsAfterPrice = unitsAfterBoost * priceMultiplier`  
   - `blockedByPrice === true` ise fiyat engeli var (çarpan zaten yansıtılmış olabilir).

3. **Sezon çarpanı**  
   - `seasonScore` (0–100), `seasonMultiplier = seasonScore / 100`  
   - `blockedBySeason = (seasonScore === 0)`  
   - `finalUnits = blockedBySeason ? 0 : unitsAfterPrice * seasonMultiplier`  
   - `finalDesired = round(finalUnits)`

4. **Stokla sınırlama**  
   - `orderedQty = min(finalDesired, qtyOnHand)`  
   - Negatif olamaz; kontrol var.

#### Step A’da Yapılan Yazmalar

- **DailyProductSalesLog (her LISTED listing için)**  
  - Unique: `(listingKey, dayKey)`.  
  - `qtyOrdered`, `expectedUnits`, `finalUnits`, `tierUsed`, `baseQty`, boost’lar, `seasonScore`, `priceMultiplier`, `blockedByPrice` / `blockedBySeason`, `salePrice`, `listPrice` ve benzeri snapshot alanları yazılır.  
  - `qtyShipped` Step B’de güncellenir (aynı log satırına increment).

- **Stok yoksa listing silme**  
  - `qtyOnHand <= 0` veya ilgili ürün için inventory yoksa: `ShowcaseListing` silinir (listing kalkar).

- **ModaverseOrder + ModaverseOrderItem (sadece bu (depo, dayKey) için sipariş yoksa)**  
  - En az bir listing’te `orderedQty > 0` ise:  
    - Bir `ModaverseOrder` oluşturulur: `companyId`, `warehouseBuildingId`, `dayKey`.  
    - Her `orderedQty > 0` ve stok kaydı olan listing için bir `ModaverseOrderItem`:  
      - `qtyOrdered`, `qtyFulfilled = 0`, `qtyShipped = 0`, `salePriceUsd`, `listingId`, `productTemplateId`, `playerProductId`, `sortIndex`.  
  - **Step A’da stok düşümü yok.**  
  - Eğer sipariş sonrası `qtyOnHand - orderedQty === 0` ise o listing yine silinir.

Özet: Step A, “o gün talep edilen miktarı” (orderedQty) belirler ve sipariş kalemlerini oluşturur; fiili stok çıkışı Step B’de yapılır.

---

### 3.3 Step B: Backlog’dan Sevkiyat ve Stok Düşümü

**Amaç:** Bekleyen sipariş kalemlerini (backlog) **kapasite** ve **stok** ile sınırlı şekilde FIFO ile “sevk” etmek; stoku düşürmek, hareket kaydı ve satış log güncellemesi yapmak.

#### Kapasite

- `BuildingMetricState`: `(buildingId, metricType = SALES_COUNT)` → `currentLevel`.  
- `MetricLevelConfig`: `(WAREHOUSE, SALES_COUNT, currentLevel)` → `maxAllowed`.  
- **Günlük sevkiyat kapasitesi:** `capacity = maxAllowed` (SALES_COUNT seviyesine göre “günde max kaç birim sevk edilebilir”).

#### Backlog

- Tüm `ModaverseOrderItem` kayıtları (şirket + depo), `order.dayKey` ve `sortIndex` ile sıralanır.  
- **Backlog:** `qtyFulfilled < qtyOrdered` olan kalemler (FIFO: önce eski günün siparişleri, sonra yeni günler).

#### Fulfillment Döngüsü

- `remainingCapacity = capacity` (gün başı).  
- Backlog’daki her kalem için (sırayla):  
  - `remaining = qtyOrdered - qtyFulfilled`  
  - İlgili ürün için depodaki stok: `available = BuildingInventoryItem.qtyOnHand`  
  - **Sevk miktarı:** `ship = min(remaining, remainingCapacity, available)`  
  - `ship <= 0` ise atla.

#### Her ship İşleminde Yapılanlar

1. **Stok düşümü**  
   - `BuildingInventoryItem`: `qtyOnHand -= ship`

2. **Hareket kaydı**  
   - `InventoryMovement`:  
     - `movementType = OUT`, `sourceType = SALES_FULFILLMENT`, `sourceRefId = orderItem.orderId`  
     - `qtyChange = ship`, `unitCost = inv.avgUnitCost`, `dayKey = normalizedDayKey`  
     - Aynı depo, `productTemplateId`, `playerProductId`.

3. **Sipariş kalemi güncelleme**  
   - `ModaverseOrderItem`: `qtyFulfilled += ship`, `qtyShipped += ship`

4. **Kapasite tüketimi**  
   - `remainingCapacity -= ship`

5. **DailyProductSalesLog güncellemesi**  
   - Siparişin oluştuğu gün: `order.dayKey`.  
   - `listingKey_dayKey = (item.listingId, order.dayKey)` ile ilgili log satırı bulunur; **update** ile `qtyShipped += ship`.  
   - (Listing silinmiş olsa bile log `listingId` ile tutulduğu için güncellenebilir.)

6. **Stok biterse listing silme**  
   - Sevk sonrası bu ürün için `qtyOnHand === 0` ve `listingId` varsa: `ShowcaseListing` silinir.

#### SALES_COUNT Metrik

- Step B sonunda `BuildingMetricState (buildingId, metricType = SALES_COUNT)` güncellenir.  
- **currentCount = o gün sevk edilen toplam birim** (`shippedToday`).  
- Yani SALES_COUNT “günlük sevkiyat sayısı”dır; birikimli değildir.

Özet: Stok **sadece Step B’de** düşer; sipariş formu Step A’da oluşur, fiili “satış/sevk” Step B’de kapasite ve stokla sınırlı FIFO ile yapılır.

---

## 4. Sipariş Formu (ModaverseOrder / ModaverseOrderItem)

- **ModaverseOrder:** Depo + gün başına tekil.  
  - `companyId`, `warehouseBuildingId`, `dayKey`.  
  - Bir günde birden fazla listing’ten gelen talepler aynı order altında toplanır.

- **ModaverseOrderItem:** Her (order, listing/product) için bir satır.  
  - `qtyOrdered`: O gün talep edilen (Step A’da hesaplanan) miktar.  
  - `qtyFulfilled` / `qtyShipped`: Step B’de backlog işlenirken artar.  
  - `salePriceUsd`, `listingId`, `productTemplateId`, `playerProductId`.

Sipariş “formu” bu order + order item’lar; raporlama ve settlement bu kayıtlar üzerinden yapılır.

---

## 5. Backlog Kontrolü

- **Backlog:** `ModaverseOrderItem` içinde `qtyFulfilled < qtyOrdered` olan tüm kalemler.  
- **Sıra:** `order.dayKey` ascending, sonra `sortIndex` ascending (önce eski günler, aynı gün içinde sırayla).  
- **Limitler:**  
  - Günlük **kapasite:** SALES_COUNT `maxAllowed`.  
  - **Stok:** Her ürün için `BuildingInventoryItem.qtyOnHand`.  
- **Kısmi sevk:** Bir kalemde `remaining` 100, kapasite 30, stok 20 ise `ship = 20`; kalem backlog’da kalmaya devam eder, sonraki günlerde tekrar işlenir.

Stok veya kapasite yetersizse o kalem o gün tam dolmaz; liste FIFO olduğu için önce eski siparişler tatmin edilir.

---

## 6. Planlanmış Maliyetler (postScheduledCompanyCosts)

**Dosya:** `lib/game/post-scheduled-company-costs.ts`

- **Gün:** `dayKey` (UTC midnight).  
- **Döngü:** `getCycleKey(dayKey)` → `YYYY-MM`.  
- **FinanceScheduleConfig:** `payrollDayOfMonth`, `rentDayOfMonth`, `overheadDayOfMonth` (yoksa varsayılan: 1, 15, 15).  
- **Ayın günü:** `dayKey.getUTCDate()`.

- **Payroll (ayın X. günü):**  
  - O gün veya öncesi işe girmiş, o gün işten çıkmamış tüm `CompanyStaff` için `monthlySalaryFinal` toplanır.  
  - Toplam tutar ledger’a OUT, PAYROLL; idempotency: `PAYROLL:{companyId}:{YYYY-MM}`.  
  - Cüzdan güncellenir.

- **Rent (ayın Y. günü):**  
  - Tüm binaların `BuildingMetricState` kayıtlarından `rentPerMonthly` (varsa) toplanır.  
  - OUT, RENT; idempotency: `RENT:{companyId}:{YYYY-MM}`.

- **Overhead (ayın Z. günü):**  
  - Aynı şekilde `overheadMonthly` toplanır.  
  - OUT, OVERHEAD; idempotency: `OVERHEAD:{companyId}:{YYYY-MM}`.

Böylece gün ilerledikçe ayın belirli günlerinde maaş, kira ve genel gider otomatik kesilir.

---

## 7. Settlement (buildAndPostSettlement)

**Dosya:** `lib/game/build-and-post-settlement.ts`

- **Ne zaman:** `isPayoutDayForCompany(companyId, newDayKey)` true ise (ör. ayın 5 ve 20’si).  
- **Periyot:** `getPeriodForPayoutDayKey(payoutDayKey)`  
  - 5 ise: önceki ay 20 – bu ay 4 (dahil).  
  - 20 ise: bu ay 5 – bu ay 19 (dahil).

- **Idempotency:** Aynı (companyId, warehouseBuildingId, periodStartDayKey, periodEndDayKey) için settlement zaten varsa tekrar oluşturulmaz; mevcut döndürülür.

- **Hesaplama:**  
  - Bu periyottaki tüm `ModaverseOrder` ve `ModaverseOrderItem` alınır.  
  - Ürün bazında: `fulfilledQty`, `grossRevenueUsd` (salePrice * fulfilledQty).  
  - `ModaverseSettlement` + `ModaverseSettlementLine` oluşturulur.  
  - Her satır için:  
    - Komisyon (PlatformFeeLevelConfig, SALES_COUNT level’a göre).  
    - Lojistik (ShippingProfileFeeConfig, ürün shipping profile).  
    - İade (deterministik seeded return rate, min–max arası).  
  - Net = gross - komisyon - lojistik - iade kesintisi.

- **Ledger / cüzdan:**  
  - Gross IN, commission OUT, logistics OUT, returns OUT ayrı ledger satırları (idempotency key’ler settlement id ile).  
  - Player cüzdanı güncellenir.

Böylece belirli günlerde “Modaverse” satışları nakit olarak oyuncuya yansır.

---

## 8. Özet Akış (DayKey +1 Anında)

| Sıra | Ne yapılır | Nerede |
|------|------------|--------|
| 1 | Saat +1 gün; eşzamanlı ilerletme kontrolü | advance-day.ts |
| 2 | Her depo: marketing (warehouse/category/product) listing’lere uygulanır | run-warehouse-day-tick |
| 3 | Her depo Step A: Talep (orderedQty) hesaplanır; DailyProductSalesLog yazılır; (depo, gün) için sipariş yoksa ModaverseOrder + Item oluşturulur; stok düşülmez | run-warehouse-day-tick |
| 4 | Her depo Step B: Backlog FIFO, kapasite + stokla sınırlı sevk; qtyOnHand düşer, InventoryMovement OUT, OrderItem qtyFulfilled/qtyShipped artar, DailyProductSalesLog qtyShipped güncellenir; SALES_COUNT = o günkü sevk | run-warehouse-day-tick |
| 5 | Planlanmış maliyetler (maaş/kira/genel gider) — ayın ilgili günüyse | post-scheduled-company-costs |
| 6 | Ödeme günüyse (5/20) her depo için settlement: periyot siparişleri → net gelir → ledger + cüzdan | build-and-post-settlement |

---

## 9. Önemli Notlar

- **Stok düşümü:** Sadece Step B (fulfillment) sırasında; Step A sadece “sipariş miktarı” ve log’u yazar.  
- **Backlog:** Tüm depo sipariş kalemleri (qtyFulfilled < qtyOrdered) order.dayKey + sortIndex ile FIFO işlenir; kapasite ve stok her adımda sınırlar.  
- **SALES_COUNT:** Günlük sevkiyat birimi; her tick’te `currentCount = o gün ship edilen toplam` olarak set edilir.  
- **Listing silme:** Stok 0’a düştüğünde veya stok kaydı yoksa ilgili ShowcaseListing silinir; tekrar listelemek gerekir.  
- **Concurrent advance:** Aynı anda iki advance-day çağrısı gelirse sadece biri saat güncellemesini alır; diğeri 409 (ADVANCE_DAY_CONCURRENT) döner.

Bu rapor, mevcut kod tabanına (advance-day, run-warehouse-day-tick, build-and-post-settlement, post-scheduled-company-costs, game-clock, marketing apply fonksiyonları) dayanmaktadır.
