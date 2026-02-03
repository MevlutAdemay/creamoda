# ShowcaseListing'e Ürün Ekleme – Hesaplar ve Aşamalar Raporu

Bu rapor, **POST /api/player/showcase-listings** ile vitrine (ShowcaseListing) ürün eklendiğinde yapılan tüm hesapları ve aşamaları açıklar.

**Kaynak:** `app/api/player/showcase-listings/route.ts`

---

## 1. Giriş ve Validasyonlar

| Adım | Açıklama |
|------|----------|
| **1.1** | Oturum kontrolü: `getServerSession()` ile kullanıcı doğrulanır. |
| **1.2** | Şirket bulunur: `playerId = session.user.id` ile `Company` bulunur. |
| **1.3** | Body’den alanlar: `warehouseBuildingId`, `inventoryItemId`, `salePrice`, `listPrice`, `isFeatured`. **Zorunlu:** warehouseBuildingId, inventoryItemId, salePrice. |
| **1.4** | Depo kontrolü: `CompanyBuilding` şu koşulla bulunur: `id = warehouseBuildingId`, `companyId = company.id`, `role = WAREHOUSE`. `marketZone` alınır; null ise 400 döner. |
| **1.5** | Envanter kalemi: `BuildingInventoryItem` bulunur (`id = inventoryItemId`, `companyBuildingId = warehouseBuildingId`). Şirkete ait olduğu doğrulanır. |
| **1.6** | Stok kontrolü: `qtyOnHand <= 0` ise listelemeye izin verilmez (400). |
| **1.7** | PlayerProduct: `playerProductId` yoksa listelemeye izin verilmez (400). |

---

## 2. Ürün Şablonu ve Tier

| Adım | Hesaplama / Kaynak |
|------|--------------------|
| **2.1** | `ProductTemplate` okunur: `suggestedSalePrice`, `categoryL3Id`, `productQuality`, `seasonScenarioDefinitionId`. |
| **2.2** | **Tier (tierUsed):** Depo metriği `BuildingMetricState` ile alınır: `buildingId` + `metricType = 'SALES_COUNT'` → `currentLevel`. **Formül:** `tierUsed = Math.min(5, Math.max(1, currentLevel ?? 1))` → 1–5 arası. |

---

## 3. Band (Talep Aralığı) Hesaplaması – `resolveBand()`

Band, günlük talep aralığını (baseMinDaily, baseMaxDaily) belirler.

### 3.1 Tier sınırlama

```
tierClamped = Math.min(5, Math.max(1, tierUsed))
```
(1–5 arası)

### 3.2 L3 kategoride band arama

**Tablo:** `ProductSalesBandConfig`

**Koşullar:**

- `categoryL3Id` = ürünün L3 kategori ID’si  
- `productQuality` = ürün kalitesi (STANDARD / PREMIUM / LUXURY)  
- `isActive = true`  
- `tierMin <= tierClamped`  
- `tierMax >= tierClamped`  

**Sonuç:** İlk eşleşen satırdan `id`, `minDaily`, `maxDaily` alınır → `baseMinDaily`, `baseMaxDaily`, `bandConfigId`, `boostSnapshot: {}`.

### 3.3 L3’te yoksa L2’de arama

- `ProductCategoryNode` ile `categoryL3Id`’nin `level` ve `parentId` değerleri alınır.  
- Eğer `level === L3` ve `parentId` varsa, **aynı koşullarla** `ProductSalesBandConfig` bu sefer `categoryL3Id: parentId` (L2) ile sorgulanır.  
- Eşleşirse L2 band’i kullanılır.

### 3.4 Fallback (hiç band yoksa)

- **baseMinDaily:** 1  
- **baseMaxDaily:** `Math.max(2, Math.min(5, tierClamped + 1))` (2–5 arası)  
- **bandConfigId:** null  
- **boostSnapshot:** `{ missingBand: true, missingBandTier: tierClamped, missingBandCategoryId: L2 veya L3 id }`  

Oyuncu bloklanmaz; varsayılan aralık kullanılır.

---

## 4. BaseQty (Günlük Talep Snapshot) Hesaplaması

**Formül:**

```ts
baseQty = (band.baseMaxDaily >= band.baseMinDaily)
  ? band.baseMinDaily + Math.floor(Math.random() * (band.baseMaxDaily - band.baseMinDaily + 1))
  : band.baseMinDaily
```

Yani: `[baseMinDaily, baseMaxDaily]` (dahil) aralığında **tek seferlik rastgele** bir tam sayı. Listing oluşturulduğu anda sabitlenir (snapshot).

---

## 5. Fiyat Snapshot – `computePriceSnapshot()`

### 5.1 Piyasa çarpanı (multiplier)

**Tablo:** `MarketZonePriceIndex`  
**Koşul:** `marketZone` = deponun marketZone’u.  
**Alanlar:** `multiplier`, `isActive`.  

- `multiplier` = `isActive && multiplier != null` ise `Number(multiplier)`, yoksa **1**.

### 5.2 Normal fiyat (normalPrice)

**Girdiler:** `salePriceNum` (oyuncunun girdiği fiyat), `suggestedSalePrice` (şablondan), `multiplier`.

```
normalPriceNum = (suggestedSalePrice != null)
  ? suggestedSalePrice * multiplier
  : salePriceNum
```

- `normalPriceNum <= 0` veya `!Number.isFinite(normalPriceNum)` ise → `normalPriceNum = salePriceNum`.  
- Tekrar `normalPriceNum <= 0` ise → yine `salePriceNum` kullanılır.  
- Sonuç 2 ondalık basamağa yuvarlanıp `Decimal` olarak saklanır (**normalPrice**).

### 5.3 PriceIndex

```
priceIndex = (normalPriceNum > 0) ? (salePriceNum / normalPriceNum) : 1
```

- `!Number.isFinite(priceIndex)` veya `priceIndex <= 0` ise → **priceIndex = 1**.

### 5.4 PriceMultiplier (adım fonksiyonu) – `getPriceMultiplier(priceIndex)`

**Kaynak:** `lib/game/price-index.ts`

| Koşul | priceMultiplier |
|-------|------------------|
| priceIndex > 1.15 | **0** (talebi tamamen keser) |
| priceIndex > 1.10 | **0.60** |
| priceIndex > 1.05 | **0.85** |
| priceIndex ≤ 0.70 | **1.30** |
| priceIndex ≤ 0.80 | **1.20** |
| priceIndex ≤ 0.90 | **1.10** |
| Diğer | **1.00** |

### 5.5 blockedByPrice

```
blockedByPrice = (priceMultiplier === 0)
```

Yani fiyat “çok yüksek” (priceIndex > 1.15) ise talep bloklanır.

---

## 6. Oyun Günü (dayKey)

```
dayKey = await getCompanyGameDayKey(company.id)
```

Şirketin o anki oyun günü (UTC midnight) alınır; yeni listing için `launchedAtDayKey` olarak kullanılır.

---

## 7. Mevcut Listing ve Boost Snapshot Birleştirme

- **Unique key:** `(companyId, marketZone, playerProductId)`.  
- Aynı ürün aynı market zone’da zaten listelenmişse mevcut kayıt bulunur; sadece `boostSnapshot` alınır.  
- **mergedBoostSnapshot:** Mevcut `boostSnapshot` (object ise) ile yeni `band.boostSnapshot` birleştirilir; yeni alanlar üzerine yazar.  
- Böylece band fallback’teki `missingBand`, `missingBandTier`, `missingBandCategoryId` gibi bilgiler korunup güncellenebilir.

---

## 8. ShowcaseListing Upsert

### 8.1 Where (benzersiz anahtar)

```
companyId_marketZone_playerProductId: {
  companyId,
  marketZone,
  playerProductId: inventoryItem.playerProductId
}
```

### 8.2 Create (yeni kayıt)

| Alan | Değer |
|------|--------|
| companyId | Şirket ID |
| marketZone | Deponun marketZone’u |
| warehouseBuildingId | Depo bina ID |
| playerProductId | Envanter kalemindeki playerProductId |
| productTemplateId | Envanter kalemindeki productTemplateId |
| salePrice | İstekten gelen salePrice (Decimal) |
| listPrice | İstekten (opsiyonel) |
| isFeatured | İstekten, yoksa false |
| status | 'LISTED' |
| pausedReason | 'NONE' |
| pausedAt | null |
| launchedAtDayKey | Yukarıdaki dayKey |
| **Snapshot (snapshotData)** | Aşağıda |
| boostSnapshot | mergedBoostSnapshot |

**snapshotData:**

- tierUsed  
- bandConfigId  
- baseMinDaily, baseMaxDaily  
- baseQty  
- normalPrice, priceIndex, priceMultiplier, blockedByPrice  

**Not:** Listing ekleme anında **seasonScore / sezon** set edilmez; bu değerler ileride (ör. advance-day veya haftalık güncelleme) doldurulur.

### 8.3 Update (kayıt zaten varsa)

Create ile aynı snapshot ve boostSnapshot uygulanır; ek olarak:

- warehouseBuildingId, marketZone, salePrice, listPrice, isFeatured, status, pausedReason, pausedAt güncellenir.  
- **seasonScore güncellenmez** (“do not set seasonScore so existing value is preserved”).

---

## 9. Özet Akış Şeması

```
1. Auth + Company + Body validasyonu
2. Warehouse + marketZone kontrolü
3. BuildingInventoryItem (envanter + playerProductId) + qtyOnHand > 0
4. ProductTemplate (suggestedSalePrice, categoryL3Id, productQuality)
5. BuildingMetricState (SALES_COUNT) → tierUsed [1..5]
6. resolveBand(categoryL3Id, productQuality, tierUsed)
   → L3 band → yoksa L2 band → yoksa fallback
   → baseMinDaily, baseMaxDaily, bandConfigId, boostSnapshot
7. baseQty = random(baseMinDaily .. baseMaxDaily)
8. MarketZonePriceIndex → multiplier
9. computePriceSnapshot(salePrice, suggestedSalePrice, multiplier)
   → normalPrice, priceIndex, priceMultiplier, blockedByPrice
10. getCompanyGameDayKey → dayKey
11. Varsa mevcut listing’ten boostSnapshot merge
12. ShowcaseListing upsert (create veya update)
```

---

## 10. Kullanılan Tablolar

| Tablo | Kullanım |
|-------|----------|
| Company | Şirket ve yetki |
| CompanyBuilding | Depo, marketZone, role |
| BuildingInventoryItem | Listeleyecek ürün, playerProductId, qtyOnHand |
| ProductTemplate | suggestedSalePrice, categoryL3Id, productQuality |
| ProductCategoryNode | L3 → L2 parent |
| ProductSalesBandConfig | baseMinDaily, baseMaxDaily (L3/L2/fallback) |
| BuildingMetricState | currentLevel → tierUsed |
| MarketZonePriceIndex | multiplier (normalPrice hesabı) |
| ShowcaseListing | Create/update listing |

Bu rapor, vitrine ürün eklerken yapılan tüm hesapların ve aşamaların tek referansı olarak kullanılabilir.
