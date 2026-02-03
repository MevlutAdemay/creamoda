# Advance Day Çalıştırıldığında Satış Nasıl Üretilir ve Hesaplanır?

Bu rapor, `lib/game/advance-day.ts` tetiklendiğinde (gün ilerletildiğinde) satışların nasıl üretildiğini ve hesaplandığını adım adım açıklar.

---

## 1. Giriş noktası: `advanceCompanyDay(companyId)`

**Dosya:** `lib/game/advance-day.ts`

Gün ilerletme tek bir fonksiyondan başlar:

1. **Oyun saati güncellenir:** `currentDayKey` bir gün ileri alınır (UTC gece yarısı).
2. **Her depo için** `runWarehouseDayTick(companyId, warehouseBuildingId, newDayKey)` çalıştırılır — satış üretimi ve sevkiyat burada yapılır.
3. **Ödeme günüyse** (ayın 5’i veya 20’si) her depo için `buildAndPostSettlement` çalışır; tahsilat/ödeme burada yapılır.

Yani satış **miktarının** hesaplanması ve **sipariş/sevkiyat** akışı tamamen `runWarehouseDayTick` içinde gerçekleşir.

---

## 2. Depo gün tik’i: `runWarehouseDayTick`

**Dosya:** `lib/game/run-warehouse-day-tick.ts`

İki aşama vardır:

- **Adım A – Sipariş üretimi:** O gün için henüz sipariş yoksa, LISTED listelerden “günlük sipariş” ve sipariş kalemleri oluşturulur; talep miktarı burada hesaplanır.
- **Adım B – Sevkiyat (fulfillment):** Bekleyen sipariş kalemleri kapasite ve stokla FIFO ile kısmen veya tam sevkedilir; stok düşer, `DailyProductSalesLog` güncellenir.

---

## 3. Satış miktarı nasıl hesaplanır? (Adım A)

### 3.1 Hangi listeler dahil?

- Sadece **LISTED** durumundaki listeler (aynı şirket + aynı depo).
- Her liste için depodaki **stok** (`BuildingInventoryItem.qtyOnHand`) kontrol edilir.
- Stok 0 veya yoksa liste **PAUSED** (OUT_OF_STOCK) yapılır ve o ürün için sipariş üretilmez.

### 3.2 “İstenen miktar” (talep): `getDesiredQty`

Her liste için sipariş miktarı şu formülle belirlenir:

```ts
orderedQty = min(desired, qtyOnHand)
```

Buradaki **desired** değeri `lib/game/demand.ts` içindeki **`getDesiredQty(productTemplateId, tier, tx)`** ile hesaplanır.

### 3.3 `getDesiredQty` içinde ne yapılıyor?

1. **Şablon bilgisi:** Ürün şablonundan `categoryL3Id` ve `productQuality` alınır.
2. **Bant (band) araması:**  
   - `ProductSalesBandConfig` tablosunda şablona uyan bir bant aranır:  
     `categoryL3Id` (veya L3 ise parent L2 id), `productQuality`, `tier` (şu an 0), `isActive: true`.  
   - L3 kategoride bant yoksa **parent L2** ile tekrar denenir (L2 banding).
3. **Bant bulunursa:**
   - **Temel değer:** `base = band.expectedMode ?? (minDaily + maxDaily) / 2`
   - **Çarpan:** Şu an 1.0 (ileride sezon vb. eklenebilir).
   - **Jitter:** ±%15 rastgele sapma: `withJitter = base * (1 + uniform(-0.15, +0.15))`
   - **Sonuç:** `desiredQty = round(max(0, withJitter))`  
   - Test ortamında `MODAVERSE_TEST_DEMAND_MULT` varsa bu değer ek çarpan olarak uygulanır.
4. **Bant bulunamazsa:**  
   - Sabit **base = 1** + aynı jitter; yine `desiredQty` tamsayı olarak döner.

Özet: Satış **miktarı** banttaki `expectedMode` (veya min/max ortası) + %15 rastgele sapma ile belirlenir; stok bunu sınırlar (`min(desired, qtyOnHand)`).

### 3.4 Adım A’da yazılan kayıtlar

- **ModaverseOrder:** O gün + depo için tek sipariş (idempotent: aynı gün tekrar çalışırsa sipariş tekrar oluşturulmaz).
- **ModaverseOrderItem:** Her liste için `qtyOrdered = min(desired, qtyOnHand)`, `qtyFulfilled = 0`, `qtyShipped = 0`.
- **DailyProductSalesLog:**  
  - `qtyOrdered` = o gün o listing için sipariş edilen miktar.  
  - `qtyShipped` Adım B’de güncellenir.

Adım A’da stoktan düşüm veya OUT hareketi **yok**; sadece sipariş ve log kaydı oluşturulur. Stok düşümü sevkiyatta (Adım B) yapılır.

---

## 4. Sevkiyat ve satış logu (Adım B)

- **Kapasite:** Deponun `BuildingMetricState` (SALES_COUNT) + `MetricLevelConfig` ile günlük **max sevkiyat adedi** alınır.
- **Backlog:** Tüm depo siparişlerinde `qtyFulfilled < qtyOrdered` olan kalemler **gün + sortIndex** ile FIFO sıralanır.
- **Döngü:** Kapasite bitene kadar:
  - Stokta yeterli varsa: `ship = min(kalan_sipariş, kalan_kapasite, qtyOnHand)`.
  - Stoktan `ship` düşülür; **InventoryMovement** (OUT, SALES_FULFILLMENT) oluşturulur.
  - **ModaverseOrderItem:** `qtyFulfilled` ve `qtyShipped` `ship` kadar artırılır.
  - **DailyProductSalesLog:** İlgili listing + dayKey için `qtyShipped` artırılır (create veya update).
  - Stok 0’a düşen listing PAUSED (OUT_OF_STOCK) yapılır.

Böylece “satış” hem sipariş (Adım A) hem de fiili sevkiyat (Adım B) ile tutarlı şekilde `DailyProductSalesLog` ve stok hareketleriyle izlenir.

---

## 5. Özet akış şeması

```
advanceCompanyDay(companyId)
  │
  ├─► Saat: currentDayKey += 1 gün
  │
  ├─► Her depo: runWarehouseDayTick(companyId, warehouseId, newDayKey)
  │     │
  │     ├─ Adım A (sipariş üretimi, günde bir kez)
  │     │   ├─ LISTED listeler + stok > 0
  │     │   ├─ desired = getDesiredQty(templateId, 0)  ← ProductSalesBandConfig + jitter
  │     │   ├─ orderedQty = min(desired, qtyOnHand)
  │     │   ├─ ModaverseOrder + ModaverseOrderItem (qtyOrdered)
  │     │   └─ DailyProductSalesLog (qtyOrdered; qtyShipped sonra Adım B’de)
  │     │
  │     └─ Adım B (sevkiyat)
  │         ├─ Kapasite = MetricLevelConfig (SALES_COUNT)
  │         ├─ FIFO backlog; ship = min(kalan, kapasite, stok)
  │         ├─ Stok düşümü + InventoryMovement OUT
  │         └─ DailyProductSalesLog.qtyShipped güncelleme
  │
  └─► newDayKey 5 veya 20 ise: buildAndPostSettlement (tahsilat/ödeme)
```

---

## 6. Özet tablo

| Konu | Açıklama |
|------|----------|
| **Talep kaynağı** | `ProductSalesBandConfig` (L2 kategori + kalite + tier); yoksa baseline 1 + jitter. |
| **Talep formülü** | `expectedMode` (veya min/max ortası) × 1.0 × (1 ± %15 jitter), yuvarlanmış. |
| **Sipariş miktarı** | `min(desired, qtyOnHand)`; stok 0 ise liste pause, sipariş yok. |
| **Sevkiyat** | Günlük kapasite ve stokla FIFO; `qtyShipped` ve stok hareketleri güncellenir. |
| **Log** | `DailyProductSalesLog`: `qtyOrdered` (Adım A), `qtyShipped` (Adım B). |

Bu rapor, `advance-day.ts` çalıştırıldığında satışın nasıl üretildiğini ve hesaplatıldığını özetler.
