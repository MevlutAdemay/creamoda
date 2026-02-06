# Season Score — Nasıl Çalışıyor? (Detaylı Rapor)

Bu rapor, **Season Score** hesaplaması, veri kaynakları, API’ler ve UI’daki gösterim kurallarını tek referansta toplar.

---

## 1. Özet

| Kavram | Açıklama |
|--------|----------|
| **Season Score (sayısal)** | 0–100 arası değer; ürünün o hafta / o bölgede “sezona uygunluk” talebini çarpan olarak kullanır. Step A (sipariş üretimi) bu değeri kullanır. |
| **ProductSeason (kategorik)** | `ProductTemplate` / Design Office’te: `WINTER` \| `SUMMER` \| `ALL`. Sadece etiketleme ve UI (örn. OfficeCard “WINTER COLLECTIONS”). Sayısal season score ile **doğrudan** eşlenmez. |
| **Seasonality (UI)** | Product Quick View ve Performance detayda: `MarketZoneSeasonScenario.weeksJson` ile “bugün” ve “gelecek 6 ay” eğrisi; metin/görsel olarak gösterilir. |

---

## 2. Veri Kaynakları ve Modeller

### 2.1 ProductTemplate

- **productSeason**: `WINTER` \| `SUMMER` \| `ALL` — Ürünün hangi mevsim koleksiyonunda olduğu (admin/tasarım).
- **seasonScenarioDefinitionId**: FK → `SeasonScenarioDefinition`. Hangi 52 haftalık senaryo eğrisinin kullanılacağını belirler.

### 2.2 SeasonScenarioDefinition

- Senaryo tanımı (kod, isim, mevsim etiketi). `MarketZoneSeasonScenario` satırları buna bağlıdır.

### 2.3 MarketZoneSeasonScenario

- **Birleşik anahtar**: `(definitionId, marketZone)`.
- **weeksJson**: 52 elemanlı dizi; **indeks 0 = yılın 1. haftası**. Her değer 0–100 arası “o haftanın talep skoru”.
- **isActive**: true olan kullanılır.

### 2.4 ShowcaseListing (snapshot)

- **seasonScore** (Int?, nullable): O anki “günlük” season skoru; Step A’da `seasonMultiplier = seasonScore / 100` ve `blockedBySeason = (seasonScore === 0)` için okunur.
- **seasonWeekIndex0** (Int?, schema’da var): Hangi hafta indeksiyle hesaplandığı (opsiyonel).
- **blockedBySeason** (Boolean): Season score 0 ise sipariş tamamen kesilir.

### 2.5 DailyProductSalesLog

- **seasonScore**, **seasonMultiplier**, **blockedBySeason**: O günkü listing snapshot’tan kopyalanır; audit/debug için.

---

## 3. Hesaplama: `getSeasonScore` (lib/game/season-score.ts)

- **Amaç**: Verilen `(marketZone, definitionId, dayKey)` için o güne denk gelen haftanın skorunu (0–100) döndürmek.
- **Hafta indeksi**: `getWeekIndex0FromDayKey(dayKey)` → yılın 0. gününden itibaren “gün / 7”, clamp 0..51. Yani **hafta 1 = indeks 0**.
- **Akış**:
  1. `definitionId` yok → `{ score: 100, missingScenario: true }`.
  2. `MarketZoneSeasonScenario.findUnique({ definitionId, marketZone, isActive: true })` → `weeksJson`.
  3. Row yok veya `weeksJson` yok → `{ score: 100, missingScenario: true }`.
  4. `weeksJson[weekIndex]` alınır, 0–100 arası clamp edilir, `{ score, missingScenario: false }` döner.

**Önemli**: Bu fonksiyon şu an **hiçbir yerde çağrılmıyor**. Yani listing’e `seasonScore` yazan bir akış yok; sadece hesaplama mantığı tanımlı.

---

## 4. Season Score’un Kullanıldığı Yerler

### 4.1 Listing oluşturma (POST /api/player/showcase-listings)

- **Create** sırasında: `seasonScore: null`, `blockedBySeason: false` atanıyor. Güncel hafta skoru **yazılmıyor**.

### 4.2 Gün ilerletme ve Step A (run-warehouse-day-tick)

- **advance-day**: `advanceCompanyDay` → her depo için `runWarehouseDayTick(companyId, warehouseId, newDayKey)`.
- **run-warehouse-day-tick** içinde:
  - LISTED listing’ler DB’den okunur; `seasonScore` select edilir.
  - **Kullanım**: `seasonScore = listing.seasonScore ?? 100`, `seasonMultiplier = seasonScore / 100`, `blockedBySeason = (seasonScore === 0)`.
  - `finalUnits = unitsAfterPrice * seasonMultiplier`; `blockedBySeason` ise `finalUnits = 0`.
  - Bu değerler `DailyProductSalesLog` upsert’inde snapshot olarak saklanır.

**Sonuç**: Listing’e `seasonScore` hiç yazılmadığı için pratikte hep **null** okunuyor ve **100** kullanılıyor; yani sezon etkisi şu an devre dışı.

### 4.3 Performans listesi (performance-data.ts)

- Liste verisi için `ShowcaseListing` üzerinden `seasonScore` okunur: `listing.seasonScore ?? 50`.
- **Kullanım**: `_seasonScore` ve sıralama (Season fit) için; yorum metninde de kullanılıyor. Değer gerçekte null olduğu için liste tarafında **50** sabiti gibi davranıyor.

### 4.4 Performans detay (detail-data.ts)

- Detay sayfasında **sayısal season score** listing’den okunmuyor; bunun yerine:
  - Listing’in `marketZone` + template’in `seasonScenarioDefinitionId` ile `MarketZoneSeasonScenario` (weeksJson) alınır.
  - `getWeekIndex0FromDayKey(currentDayKey)` ile mevcut hafta indeksi hesaplanır.
  - **next6MonthlyScoresFromWeeksJson**: mevcut haftadan itibaren 6 “ay” (her biri 4 hafta), her ay için 4 haftalık ortalaması alınır → 6 skor (0–100).
  - **forecastOutlook**: 6 aylık ortalama skora göre `Strong` (≥60), `Neutral` (35–59), `Weak` (<35).
  - **willStockEndBeforePeakNote**: stok günü vs tahmini peak süresi karşılaştırması.

Burada kullanılan “season” verisi **doğrudan** `weeksJson`; listing’deki `seasonScore` alanı kullanılmıyor.

### 4.5 Product Quick View (GET /api/player/product-quick-view)

- **buildSeasonalityByZone**:
  - `ProductTemplate.seasonScenarioDefinitionId` + tüm warehouse `marketZone`’ları ile `MarketZoneSeasonScenario` çekilir.
  - Hafta: `getUtcDayOfYear` → `getWeekIndexFromDayOfYear` (1..52); quick-view tarafında **weekIndex 1..52**, dizi erişimi `weekIndex - 1` (yani 0..51) ile yapılır; season-score’taki 0..51 ile uyumlu.
  - **todayScore**: o haftanın skoru (0–100).
  - **months**: sonraki 6 takvim ayı; her ay için 1, 8, 15, 22. günlerin hafta skorları ortalanır.
  - **peakMonths**: skoru peak’in %90+ olan ayların etiketleri.
- **Eksik / hata**: `missingCurve` (scenario/zone yok), `curveAllZeros` (weeksJson tamamen 0).

### 4.6 Sim Debug (GET /api/player/sim-debug)

- Günlük satış simülasyonu sonuçlarında listing’den gelen `seasonScore`, `seasonMultiplier`, `blockedBySeason` döndürülür (debug tablosu).

### 4.7 Advance Day Panel (UI)

- Sim debug tablosunda **Season Score** sütunu: `r.seasonScore ?? '—'`.
- **Blocked** sütunu: `P` (price), `S` (season) — `r.blockedBySeason`.

---

## 5. UI Gösterim Kuralları

### 5.1 OfficeCard (components/player/designoffices/OfficeCard.tsx)

- **Season ile ilgili gördüğünüz**: Sayısal **season score** değil; **productSeason** (WINTER / SUMMER / ALL).
- **collectionsLabel(studio.productSeason, studio.audience)**:
  - `audience` varsa → `"{AUDIENCE} COLLECTIONS"`.
  - `productSeason === 'ALL'` → `"ALL COLLECTIONS"`.
  - Diğer → `"WINTER COLLECTIONS"` / `"SUMMER COLLECTIONS"`.
- **humanizeSeason**: Winter, Summer, All Seasons (görüntüleme metni).

### 5.2 ProductCard / Quick View (SCORE sekmesi, seasonality)

- **todayScore**:
  - Veri yok / missingCurve / curveAllZeros → "No season data" veya "Out of season".
  - Aksi halde: `todayScore >= 70` → "Good {score}", `>= 40` → "Okay {score}", değilse "Bad {score}".
- **6 aylık eğri**: Aylık ortalama skorlar ve peak aylar etiketlenir.

### 5.3 Performance Detail (PerformanceDetailClient)

- **Forecast** kartı: `forecastOutlook` (Strong / Neutral / Weak), sonraki 6 “ay” skorları, peak notu (`willStockEndBeforePeakNote`).
- Tüm bu veriler `MarketZoneSeasonScenario.weeksJson` + `getWeekIndex0FromDayKey` + `next6MonthlyScoresFromWeeksJson` ile türetilir; **ShowcaseListing.seasonScore** kullanılmaz.

### 5.4 Performance List

- **Season fit** sıralaması: `_seasonScore` (listing’den gelen `seasonScore ?? 50`) ile yapılır. Şu an değer null olduğu için pratikte 50 sabiti.

### 5.5 Advance Day Panel — Debug tablosu

- **Season Score**: Listing’den okunan ham değer (`r.seasonScore ?? '—'`).
- **Blocked**: `S` = `blockedBySeason`.

---

## 6. Hafta İndeksi Tutarlılığı

| Dosya | Hafta indeksi | Aralık | Hafta 1 |
|------|----------------|--------|---------|
| **lib/game/season-score.ts** | `getWeekIndex0FromDayKey` | 0..51 | index 0 |
| **lib/game/date-utils.ts** | `getWeekIndexFromDayOfYear` | 1..52 | week 1 |
| **product-quick-view** | `getWeekIndexFromDayOfYear` → dizi erişimi `weekIndex - 1` | 0..51 | index 0 |
| **detail-data.ts** | `getWeekIndex0FromDayKey` | 0..51 | index 0 |

Tüm kullanımlar “hafta 1 = weeksJson[0]” ile uyumlu.

---

## 7. Eksik / Dikkat Edilmesi Gerekenler

1. **Listing’e season score yazılmıyor**: `getSeasonScore` hiçbir yerde çağrılmıyor. Step A’da `listing.seasonScore ?? 100` kullanıldığı için şu an tüm listing’ler 100 kabul ediliyor; sezonun sipariş miktarına etkisi yok.
2. **Season score’u güncel tutmak için**: Advance-day veya ayrı bir job’da, her LISTED listing için `(marketZone, template.seasonScenarioDefinitionId, currentDayKey)` ile `getSeasonScore` çağrılıp `ShowcaseListing.seasonScore` ve isteğe bağlı `blockedBySeason` güncellenmeli.
3. **OfficeCard**: Sadece `productSeason` (WINTER/SUMMER/ALL) gösterir; sayısal season score veya scenario eğrisi ile bağlantılı değildir.

---

## 8. API Özeti

| API / Modül | Season ile ilgili ne yapar? |
|-------------|-----------------------------|
| **POST showcase-listings** | Create’te `seasonScore: null`, `blockedBySeason: false` set eder; güncel skor hesaplanmaz. |
| **GET product-quick-view** | `buildSeasonalityByZone` → weeksJson ile todayScore, 6 ay, peakMonths; UI’da “Good/Okay/Bad” ve eğri. |
| **advance-day** | `runWarehouseDayTick` çağırır; tick içinde listing’den okunan `seasonScore` (null→100) kullanılır; listing güncellenmez. |
| **sim-debug** | Listing’den `seasonScore`, `blockedBySeason` döner. |
| **performance-data (list)** | Listing’den `seasonScore ?? 50` okur; sıralama ve yorum için. |
| **detail-data** | Listing’in marketZone + template’in definitionId ile weeksJson alır; forecast/outlook hesaplar; listing.seasonScore kullanmaz. |
| **lib/game/season-score.ts** | `getSeasonScore(marketZone, definitionId, dayKey, tx)` tanımlı; **çağrılmıyor**. |

Bu rapor, season score ile ilgili yapacağınız düzenlemelerde tek referans olarak kullanılabilir.
