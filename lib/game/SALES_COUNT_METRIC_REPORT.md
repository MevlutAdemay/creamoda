# BuildingMetricState (SALES_COUNT) Güncelleme Raporu

## Özet

Simülasyon (gün ilerleme) tamamlandığında **BuildingMetricState** tablosunda `metricType = SALES_COUNT` olan kayıt, **warehouse bazında** güncelleniyor. Bu rapor, **hangi veri ile** güncellendiğini ve **nerede** güncellendiğini açıklar.

---

## 1. Simülasyon akışı (advance-day)

- **Dosya:** `lib/game/advance-day.ts`
- Her gün ilerlemesinde tüm warehouse’lar için `runWarehouseDayTick(companyId, warehouseBuildingId, newDayKey)` çağrılır.
- SALES_COUNT güncellemesi **runWarehouseDayTick** içinde yapılır (başka yerde simülasyon sonrası SALES_COUNT yazılmıyor).

---

## 2. BuildingMetricState (SALES_COUNT) nerede güncelleniyor?

### 2.1 Ana güncelleme: `lib/game/run-warehouse-day-tick.ts`

**Satır 411–424:**

```ts
// SALES_COUNT is daily only: set currentCount = today's shipped qty (do not accumulate)
await tx.buildingMetricState.upsert({
  where: {
    buildingId_metricType: {
      buildingId: warehouseBuildingId,
      metricType: MetricType.SALES_COUNT,
    },
  },
  create: { ..., currentCount: shippedToday, ... },
  update: { currentCount: shippedToday, lastEvaluatedAt: new Date() },
});
```

**Kullanılan değişken:** `shippedToday`

**`shippedToday` nasıl hesaplanıyor? (Satır 326–375)**

- Step B (fulfillment) döngüsünde her sevk edilen partide:
  - `ship = Math.min(remaining, remainingCapacity, available)` (birim cinsinden)
  - `shippedToday += ship`
- Yani **shippedToday = o gün bu warehouse’dan sevk edilen toplam birim sayısı** (quantity / adet), **kapasite değil**.
- **Kapasite** (`capacity = levelConfig?.maxAllowed`) sadece **üst sınır** olarak kullanılıyor; `currentCount` alanına **yazılmıyor**.

**Sonuç:**  
Simülasyon sonrası SALES_COUNT için **kullanılan veri = o gün sevk edilen toplam birim (sevk miktarı)**.  
Ne “o gün oluşturulan sipariş adedi” (order count) ne de “kapasite adedi” (maxAllowed) yazılmıyor.

---

## 3. Diğer yerler (SALES_COUNT yazma)

| Konum | Ne yapıyor |
|--------|-------------|
| `lib/game/simulation/apply-sales-fulfillment.ts` | SALES_COUNT sadece **okunuyor** (currentLevel ile capacity alınıyor); **currentCount güncellenmiyor**. |
| `lib/game/build-and-post-settlement.ts` | SALES_COUNT sadece **okunuyor** (currentLevel); **currentCount güncellenmiyor**. |
| `app/api/player/warehouse/logistics/part-time/apply/route.ts` | Part-time personel ile backlog temizlenince **currentCount** güncelleniyor: `actualCleared` (o işlemde sevk edilen birim) kadar **increment** veya set. |

Yani simülasyon tarafında tek yazım noktası **run-warehouse-day-tick.ts**; orada yazılan değer **sadece `shippedToday`** (birim).

---

## 4. Development Stages ile ilişki

- **Dosyalar:**  
  - `app/api/player/warehouse/upgrade/preview/route.ts`  
  - `app/api/player/warehouse/upgrade/process/route.ts`
- **Mantık:**  
  - `BuildingMetricState.currentCount` (SALES_COUNT) okunuyor.  
  - Bir üst seviye için `MetricLevelConfig.minRequired` ile karşılaştırılıyor.  
  - `currentCount >= minRequired` ise upgrade uygun görülüyor.

**Olası uyumsuzluk:**

- **Şu an:** `currentCount` = **o gün sevk edilen toplam birim** (günlük, birikim yok).
- **İstenen (sizin ifadeniz):** “O gün oluşturulan **sipariş adedi**” ile güncellenmesi.
- **“Kapasite adedi”:** Kod incelemesinde `currentCount` hiçbir yerde `maxAllowed` (kapasite) ile set edilmiyor; sadece sevk miktarı (`shippedToday`) yazılıyor. Yani teknik olarak “kapasite adedi ile güncelliyor” değil, **“sevk edilen birim”** ile güncelliyor. Günlük sevk miktarı kapasite ile sınırlı olduğu için değer kapasiteyi geçemiyor; bu yüzden “kapasite kadar bir sayı” görülebilir.

Eğer **MetricLevelConfig.minRequired** “sipariş sayısı” (veya başka bir metrik) anlamında tanımlanmışsa ve biz **birim (sevk miktarı)** yazıyorsak, Development Stages doğru çalışmaz; birim vs sipariş sayısı farklı ölçeklerdir.

---

## 5. Özet tablo

| Soru | Cevap |
|------|--------|
| Simülasyon sonrası SALES_COUNT **nerede** güncelleniyor? | `lib/game/run-warehouse-day-tick.ts` (satır 411–424). |
| **Hangi veri** ile güncelleniyor? | **shippedToday** = o gün o warehouse’dan sevk edilen **toplam birim (quantity)**. |
| Kapasite (maxAllowed) yazılıyor mu? | Hayır. Kapasite sadece sevk üst limiti; `currentCount`’a yazılan değer değil. |
| Sipariş adedi yazılıyor mu? | Hayır. Sadece sevk edilen birim toplamı yazılıyor. |
| Development Stages’ı ne etkiler? | Upgrade için `currentCount` (şu an: günlük sevk birimi) ile `minRequired` karşılaştırılıyor; birim vs sipariş sayısı karışırsa stage mantığı bozulur. |

---

## 6. Önerilen sonraki adım

- **MetricLevelConfig.minRequired** için tasarım netleştirilmeli:  
  - “Sevk edilen **birim** mi?” (mevcut yazılan)  
  - “O gün oluşturulan **sipariş (order) adedi** mi?”  
  - “Sipariş **kalem (order item) adedi** mi?”  
  - Yoksa başka bir metrik mi (örn. belirli bir periyottaki toplam)?
- Buna göre:
  - Ya **run-warehouse-day-tick.ts** içinde `currentCount`’u istenen metrikle (örn. sipariş adedi / order item adedi) güncellemek,
  - Ya da config’i “birim” anlamında bırakıp mevcut `shippedToday` ile tutarlı hale getirmek gerekir.

Bu rapor, “Simülasyon sonrası BuildingMetricState metricType=SALES_COUNT hangi veri ile güncelliyor?” sorusunun cevabını tek cümlede şöyle özetler:  
**O gün o warehouse’dan sevk edilen toplam birim (artık o gün oluşturulan sipariş adedi (ModaverseOrder count) ile güncelliyor.**
