# Sales Sayfası (app/player/sales) — İşlem ve Kurallar Raporu

Bu rapor, **app/player/sales/page.tsx** sayfası, içindeki **ShowcaseBuilder** bileşeni ve kullandığı API'ler üzerinden yapılan işlemleri ve uygulanan kuralları özetler.

---

## 1. Sayfa Yapısı

| Öğe | Açıklama |
|-----|----------|
| **Dosya** | `app/player/sales/page.tsx` |
| **Tip** | Client component (`'use client'`) |
| **Ana bileşen** | `ShowcaseBuilder` (`_components/ShowcaseBuilder.tsx`) |
| **Amaç** | Depodaki ürünleri vitrine (showcase) listeleme; oyun günü ilerletildiğinde satış üretilir. |

Sayfa, kullanıcıya şu bilgiyi verir:
- Depodan ürünleri vitrine listele.
- Listelemeden sonra oyun gününü ilerlet ki satışlar oluşsun.

---

## 2. Kullanılan API'ler

| API | Metod | Kullanım yeri | Açıklama |
|-----|--------|----------------|----------|
| `/api/player/warehouses` | GET | Sayfa yükleme | Oyuncunun depolarını listeler. |
| `/api/player/warehouse-inventory?warehouseBuildingId=...` | GET | Depo seçilince / Refresh | Seçilen deponun stok kalemlerini (qty > 0) getirir. |
| `/api/player/showcase-listings?warehouseBuildingId=...` | GET | Depo seçilince / Listeleme sonrası | Bu depoya ait vitrin listelerini getirir. |
| `/api/player/showcase-listings` | POST | Listele / Fiyat güncelle | Yeni listing oluşturur veya mevcut listing fiyatını günceller. |
| `/api/player/showcase-listings/:id/pause` | POST | Remove | Listing'i siler (kalıcı delete). |

---

## 3. API Kuralları ve İş Mantığı

### 3.1 GET /api/player/warehouses

- **Yetki:** Session'dan `userId` alınır; bu kullanıcıya ait **Company** bulunur.
- **Kural:** Sadece `role = WAREHOUSE` olan **CompanyBuilding** kayıtları döner.
- **Dönen alanlar:** `id`, `name`, `marketZone`, `countryName`.

---

### 3.2 GET /api/player/warehouse-inventory

- **Parametre:** `warehouseBuildingId` zorunlu.
- **Yetki:** Session → Company; depo bu şirkete ait ve `role = WAREHOUSE` olmalı.
- **Filtreler:**
  - `qtyOnHand > 0`
  - `isArchived: false`
- **Kural:** Sadece bu depoya ait, elinde miktarı olan ve arşivlenmemiş **BuildingInventoryItem** satırları döner.
- **Dönen alanlar:** `inventoryItemId`, `productTemplateId`, `playerProductId`, `qtyOnHand`, `avgUnitCost`, `productTemplate` (name, code, suggestedSalePrice, productQuality).

---

### 3.3 GET /api/player/showcase-listings

- **Parametreler:** `warehouseBuildingId`, `marketZone` (opsiyonel).
- **Yetki:** Session → Company.
- **Filtre:** `companyId` eşleşmeli, `status = 'LISTED'`.
- **Kural:** Sadece **LISTED** durumundaki listing'ler döner; warehouse/marketZone ile filtreleme yapılabilir.
- **Ek:** Her listing için ilgili depodaki **BuildingInventoryItem** üzerinden `inventoryItemId` eşleştirilir (fiyat güncelleme modal'ında kullanılmak üzere).

---

### 3.4 POST /api/player/showcase-listings (Oluşturma / Fiyat Güncelleme)

**Zorunlu body alanları:**
- `warehouseBuildingId`
- `inventoryItemId`
- `salePrice`

**Opsiyonel:** `listPrice`, `isFeatured`.

**Doğrulama kuralları (sırayla):**
1. Depo şirkete ait ve `BuildingRole.WAREHOUSE` olmalı.
2. Deponun `marketZone` değeri set edilmiş olmalı.
3. `inventoryItemId` bu depoya ait olmalı ve item şirkete ait olmalı.
4. **qtyOnHand > 0** olmalı (0 ise listeleme yapılamaz).
5. **playerProductId** dolu olmalı (yoksa "cannot list yet" hatası).

**Benzersizlik kuralı (schema):**  
`(companyId, marketZone, playerProductId)` unique. Aynı ürün aynı bölgede zaten listed ise **UPDATE**, değilse **CREATE** yapılır.

**CREATE sırasında hesaplananlar:**
- **Fiyat snapshot:**  
  - `normalPrice = suggestedSalePrice * MarketZonePriceIndex.multiplier` (veya uygun fallback).  
  - `priceIndex = salePrice / normalPrice`.  
  - `priceMultiplier = getPriceMultiplier(priceIndex)` (adımlı çarpan).  
  - `blockedByPrice`: priceMultiplier 0 ise true (fiyat çok yüksek).
- **Satış bandı:**  
  - Depo için `SALES_COUNT` metric'inden `tierUsed` (1–5) alınır.  
  - Ürünün kategori (L3/L2) ve kalitesine göre **ProductSalesBandConfig** ile `baseMinDaily`, `baseMaxDaily` çözülür.  
  - Band yoksa fallback: baseMinDaily=1, baseMaxDaily = tier'a göre 2–5.  
  - `baseQty` = baseMinDaily ile baseMaxDaily arasında rastgele bir tam sayı.
- **Oyun günü:** `launchedAtDayKey` = şirketin o anki game day key.

**UPDATE sırasında:** Sadece fiyat ve liste fiyatı ile ilgili alanlar güncellenir; base snapshot (band, baseQty vb.) korunur.

---

### 3.5 POST /api/player/showcase-listings/:id/pause

- **Yetki:** Session → Company; listing `companyId` ile eşleşmeli.
- **İşlem:** **ShowcaseListing** kaydı **kalıcı silinir** (`deleteMany`). UI tarafında "Remove" olarak kullanılıyor.

---

## 4. Fiyat Çarpanı Kuralları (price-index)

`lib/game/price-index.ts` içinde **getPriceMultiplier(priceIndex)**:

- `priceIndex = salePrice / normalPrice` (normalPrice = suggestedSalePrice * bölge çarpanı).
- **Adımlı çarpan:**
  - priceIndex > 1.15 → **0** (talebi tamamen keser, blockedByPrice).
  - priceIndex > 1.10 → 0.60  
  - priceIndex > 1.05 → 0.85  
  - priceIndex ≤ 0.70 → 1.30  
  - priceIndex ≤ 0.80 → 1.20  
  - priceIndex ≤ 0.90 → 1.10  
  - Diğer → 1.00  

Yani fiyat ne kadar yüksekse talep çarpanı düşer; çok yüksek olunca satış bloke edilir.

---

## 5. ShowcaseBuilder Bileşeni — UI Kuralları

- **Depo seçimi:** Dropdown ile warehouse seçilir; seçilen deponun `marketZone` değeri gösterilir.
- **Envanter tablosu:** Sadece `qtyOnHand > 0` ve API'den gelen kalemler listelenir.  
  - **Listeleme kuralı:** Sadece `playerProductId` dolu olan kalemler listelenebilir; yoksa "No playerProductId — cannot list" uyarısı ve List butonu devre dışı.
- **Varsayılan satış fiyatı:**  
  - `suggestedSalePrice` varsa ve > 0 ise o kullanılır.  
  - Yoksa `avgUnitCost * 1.8` kullanılır.
- **Listeleme:** Geçerli bir sayısal `salePrice` gerekir; POST ile listing oluşturulur veya güncellenir.
- **Mevcut listeler:** Bu depoya ait LISTED listing'ler tabloda gösterilir; her satırda **Update** (fiyat/listPrice) ve **Remove** (pause/delete) vardır.
- **Fiyat güncelleme modal'ı:**  
  - Sale price zorunlu, > 0.  
  - List price opsiyonel; girilmişse > 0 olmalı.  
  - Güncelleme yine POST `/api/player/showcase-listings` ile yapılır (aynı companyId + marketZone + playerProductId ile UPDATE tetiklenir).

---

## 6. Özet Tablo

| Konu | Kural / İşlem |
|------|----------------|
| Yetkilendirme | Tüm API'ler session → Company; depolar ve listing'ler şirkete ait olmalı. |
| Listeleme koşulları | qtyOnHand > 0, playerProductId dolu, depoda marketZone set. |
| Benzersizlik | Aynı company + marketZone + playerProductId için tek LISTED listing; tekrar POST = fiyat güncelleme. |
| Fiyat etkisi | priceIndex (salePrice/normalPrice) ile adımlı talep çarpanı; >1.15 ise blockedByPrice. |
| Satış bandı | Kategori + kalite + depo SALES_COUNT tier'ına göre baseMinDaily/baseMaxDaily; yoksa fallback. |
| Remove | Listing kalıcı silinir (pause route'u aslında delete). |

Bu rapor, sales sayfası ve showcase listing akışındaki işlemler ile uygulanan kuralların özetidir.
