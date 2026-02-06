# Showcase Listeleme: Fiyat (Ucuz / Pahalı) ve Boost Çarpanı Hesaplama Raporu

Bu dokümanda, **Inventory'deki ürünü Showcase'e eklerken** oyuncunun girdiği fiyata göre **ucuz / pahalı durumu** ve **talep çarpanı (price multiplier)** nasıl hesaplandığı özetlenmektedir.

---

## 1. Veri Akışı

- **UI:** `app/player/sales/_components/`  
  - `InventoryGrid`: Listelenecek envanter ürünleri  
  - `PriceDialog`: Oyuncunun **sale price** (satış fiyatı) girdiği modal  
  - `SalesShowcaseClient`: Listeleme/ güncelleme isteğini `POST /api/player/showcase-listings` ile gönderir  

- **API:** `app/api/player/showcase-listings/route.ts` (POST)  
  - Gelen: `warehouseBuildingId`, `inventoryItemId`, `salePrice` (zorunlu), isteğe bağlı `listPrice`, `isFeatured`  
  - Hesaplanan: **normal fiyat**, **priceIndex**, **priceMultiplier**, **blockedByPrice**  
  - Kayıt: `ShowcaseListing` tablosuna yazılır (create veya update)

- **Çarpan fonksiyonu:** `lib/game/price-index.ts` → `getPriceMultiplier(priceIndex)`

---

## 2. “Normal Fiyat” (Referans Fiyat)

Oyuncunun fiyatı, **pazarın “normal” fiyatına** göre kıyaslanır.

**Formül:**

```text
normalPrice = suggestedSalePrice × multiplier
```

- **suggestedSalePrice:** Ürün şablonundaki önerilen satış fiyatı (`ProductTemplate.suggestedSalePrice`).
- **multiplier:** Deponun bağlı olduğu **ülkenin** pazar çarpanı (`CompanyBuilding` → `Country.priceMultiplier`).  
  - UI’da “Suggested Sale Price” olarak gösterilen değer de aynı formülle hesaplanır:  
    `suggestedSalePrice × warehouse.country.priceMultiplier`.

**Kaynak:** `showcase-listings/route.ts` satır 431–436:

```ts
const multiplier =
  warehouse.country?.priceMultiplier != null
    ? Number(warehouse.country.priceMultiplier)
    : 1;
const suggestedNum = template.suggestedSalePrice != null ? Number(template.suggestedSalePrice) : 0;
// ...
const priceSnapshot = computePriceSnapshot(salePriceNum, suggestedNum || null, multiplier);
```

**computePriceSnapshot** içinde (`route.ts` 139–148):

- `normalPriceNum = suggestedSalePrice * multiplier`  
  (suggested yoksa veya geçersizse `salePriceNum` kullanılır.)
- `normalPriceNum <= 0` ise yine `salePriceNum` kullanılır.

Yani “normal fiyat”, o pazar (ülke) için referans satış fiyatıdır; oyuncu fiyatı buna göre **ucuz** veya **pahalı** sayılır.

---

## 3. Fiyat İndeksi (priceIndex) — Ucuz / Pahalı Oranı

Oyuncunun girdiği fiyatın, normal fiyata oranı:

**Formül:**

```text
priceIndex = salePrice / normalPrice
```

- **salePrice:** Oyuncunun girdiği satış fiyatı.  
- **normalPrice:** Yukarıdaki `suggestedSalePrice × multiplier` (veya fallback) ile hesaplanan değer.

**Anlam:**

- **priceIndex < 1** → Oyuncu fiyatı normal fiyatın altında → **ucuz** tarafta.
- **priceIndex = 1** → Oyuncu fiyatı normal fiyata eşit.
- **priceIndex > 1** → Oyuncu fiyatı normal fiyatın üstünde → **pahalı** tarafta.

**Kod:** `computePriceSnapshot` içinde (satır 149–152):

```ts
let priceIndex = normalPriceNum > 0 ? salePriceNum / normalPriceNum : 1;
if (!Number.isFinite(priceIndex) || priceIndex <= 0) {
  priceIndex = 1;
}
```

Geçersiz veya sıfıra bölüm durumunda `priceIndex = 1` (nötr) kullanılır.

---

## 4. Talep Çarpanı (priceMultiplier) — “Boost” Etkisi

**priceIndex** tek başına oyuncuya gösterilmez; simülasyonda **talep çarpanı** olarak kullanılır. Bu çarpan, **ucuzsa talebi artırır, pahalıysa düşürür veya bloklar.**

**Kaynak:** `lib/game/price-index.ts` — `getPriceMultiplier(priceIndex)`:

| Koşul (priceIndex) | priceMultiplier | Anlam (talep etkisi) |
|--------------------|-----------------|-----------------------|
| **> 1.15**         | **0**           | Çok pahalı → satış **bloke** (blockedByPrice = true) |
| **> 1.10**         | **0.60**        | Pahalı → talep belirgin düşüş |
| **> 1.05**         | **0.85**        | Biraz pahalı → talep hafif düşüş |
| **≤ 0.70**         | **1.30**        | Ucuz → talep **+%30** (en yüksek bonus) |
| **≤ 0.80**         | **1.20**        | Ucuz → talep +%20 |
| **≤ 0.90**         | **1.10**        | Ucuz → talep +%10 |
| **Diğer**          | **1.00**        | Nötr (normal talep) |

**Özet:**

- **Ucuz (priceIndex ≤ 0.9):** Çarpan 1.1 / 1.2 / 1.3 → talep **artar** (oyunda “boost” hissi).
- **Pahalı (priceIndex > 1.05):** Çarpan 0.85 / 0.6 → talep **düşer**.
- **Çok pahalı (priceIndex > 1.15):** Çarpan 0 → **blockedByPrice = true**, satış bloke.

**Kod:** `lib/game/price-index.ts`:

```ts
export function getPriceMultiplier(priceIndex: number): number {
  if (priceIndex > 1.15) return 0;
  if (priceIndex > 1.1) return 0.6;
  if (priceIndex > 1.05) return 0.85;
  if (priceIndex <= 0.7) return 1.3;
  if (priceIndex <= 0.8) return 1.2;
  if (priceIndex <= 0.9) return 1.1;
  return 1;
}
```

`computePriceSnapshot` içinde (route.ts 153–154):

```ts
const priceMultiplier = getPriceMultiplier(priceIndex);
const blockedByPrice = priceMultiplier === 0;
```

---

## 5. Showcase Kaydına Yazılanlar

POST ile listing oluşturulurken/güncellenirken şu alanlar set edilir:

- **normalPrice** — Hesaplanan referans fiyat (Decimal).
- **priceIndex** — `salePrice / normalPrice`.
- **priceMultiplier** — `getPriceMultiplier(priceIndex)` (0, 0.6, 0.85, 1, 1.1, 1.2, 1.3).
- **blockedByPrice** — `priceMultiplier === 0` (çok pahalı ise true).

Bunlar **ShowcaseListing** ve günlük satış simülasyonunda (ör. `run-warehouse-day-tick`, `DailyProductSalesLog`) kullanılır; beklenen talep bu çarpanla scale edilir.

**Not:** Kartlarda gördüğün “Boost: +X%” değeri, bu **priceMultiplier** değil; **positiveBoostPct** (kampanya / görsel unlock) kaynaklıdır. Fiyata bağlı “ucuz/pahalı” etkisi sadece **priceMultiplier** ve **blockedByPrice** ile simülasyonda uygulanır; şu an Sales UI’da `priceIndex` / `priceMultiplier` ayrıca gösterilmiyor.

---

## 6. Özet Akış (Adım Adım)

1. Oyuncu **PriceDialog**’da satış fiyatı girer (`salePrice`).
2. **POST** ile `warehouseBuildingId`, `inventoryItemId`, `salePrice` gönderilir.
3. API:
   - Warehouse’un `Country.priceMultiplier` değerini alır.
   - Ürünün `ProductTemplate.suggestedSalePrice` değerini alır.
   - **normalPrice** = `suggestedSalePrice × multiplier` (veya fallback).
   - **priceIndex** = `salePrice / normalPrice`.
   - **priceMultiplier** = `getPriceMultiplier(priceIndex)` (0 / 0.6 / 0.85 / 1 / 1.1 / 1.2 / 1.3).
   - **blockedByPrice** = (priceMultiplier === 0).
4. Bu değerler **ShowcaseListing**’e yazılır; simülasyon bu listing’i kullanırken talebi **priceMultiplier** ile çarpar.

Bu hesaplama, **ucuz (priceIndex düşük) → yüksek çarpan**, **pahalı (priceIndex yüksek) → düşük çarpan veya bloke** mantığını oluşturur; “ucuz / pahalı durumu” ve “boost çarpanı” böyle üretilir.
