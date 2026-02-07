# Plan: Start Campaign Modal from Performance Detail

## Amaç

Performance detay sayfasındaki **"Start Campaign"** butonuna tıklanınca Marketing sayfasına yönlendirmek yerine, **aynı sayfada bir modal açılsın**. Warehouse ve ürün zaten seçili olduğu için modalda sadece **kampanya paketleri (kartlar)** listelenecek; kullanıcı bir paket seçip kampanyayı buradan başlatacak.

## Mevcut akış (Marketing / NewCampaignSheet)

1. **Adım 1:** Warehouse seç → (Product sekmesinde) Ürün seç → Next  
2. **Adım 2:** Kampanya paketi seç (PackageCarousel) → Next  
3. **Adım 3:** Özet (CampaignSummary) + "Start Campaign" → POST API  

**Kullanılan API’ler:**

- `GET /api/player/marketing-packages?scope=PRODUCT` → Paket listesi  
- `GET /api/player/marketing-pricing-preview?scope=PRODUCT&packageId=...&warehouseBuildingId=...` → Tahmini maliyet (step 3)  
- `POST /api/player/product-marketing-campaigns` → Kampanya oluştur  
  - Body: `{ warehouseBuildingId, listingId, packageId }`

## Yeni akış (Performance Detail)

- **Bağlam:** Sayfada zaten `data.warehouseId`, `data.listingId`, `data.productName` (ve istenirse `data.warehouseLabel`) var.  
- **Modal açıldığında:** Warehouse/ürün seçimi yok; doğrudan kampanya paketleri gösterilir.  
- **Adım 1:** Kampanya paketlerini listele (PackageCarousel veya PackageGrid), kullanıcı bir paket seçer → Next  
- **Adım 2:** Özet (ürün adı, paket, süre, tahmini maliyet) + "Start Campaign" → POST aynı API  

Böylece Marketing’teki 3 adım, Performance’ta 2 adıma iner (hedef seçim atlanır).

---

## 1. Veri: `currentDayKey`

- **Neden gerekli:** CampaignSummary’de “Start date / End date” göstermek için.  
- **Nereden:** Şu an `PerformanceDetailData` içinde yok; detay sayfası server component.  
- **Ne yapılacak:**  
  - `app/player/performance/[playerProductId]/page.tsx` içinde `getCompanyGameDayKey(company.id)` ile `currentDayKey` alınacak (ISO date string veya `formatDayKeyString` ile).  
  - Bu değer `PerformanceDetailClient`’a prop olarak geçirilecek (örn. `currentDayKey?: string`).  
  - Modal, özet adımında başlangıç = `currentDayKey`, bitiş = `currentDayKey + (package.durationDays - 1)` gün kullanacak.

---

## 2. Yeni bileşen: `StartProductCampaignModal`

**Konum:** `app/player/performance/_components/StartProductCampaignModal.tsx`

**Props:**

- `open: boolean`  
- `onOpenChange: (open: boolean) => void`  
- `warehouseId: string`  
- `listingId: string`  
- `productName: string` (özet ekranında “Target” için)  
- `warehouseLabel?: string` (isteğe bağlı, özette warehouse adı)  
- `currentDayKey: string` (tarih aralığı ve özet için)  
- `onSuccess?: () => void` (kampanya başarıyla oluştuktan sonra, örn. liste yenileme)

**Davranış:**

1. **Mount / open olduğunda**  
   - `GET /api/player/marketing-packages?scope=PRODUCT` ile paketleri al.  
   - State: `packages`, `loadingPackages`, `selectedPackageId`, `step` (1 | 2).

2. **Step 1 – Paket seçimi**  
   - Marketing’teki **PackageCarousel** (veya **PackageGrid**) + **PackageCard** kullanılacak.  
   - Bu bileşenler `app/player/marketing/_components/` altında; performans modülünden import edilebilir:  
     `import { PackageCarousel } from '@/app/player/marketing/_components/PackageCarousel';`  
     `import type { PackageItem } from '@/app/player/marketing/_components/PackageCard';`  
   - `formatUsd` fonksiyonu NewCampaignSheet’tekine benzer şekilde lokal veya `lib/format` kullanılabilir.  
   - Kullanıcı bir paket seçer → “Next” ile step 2’ye geçilir.

3. **Step 2 – Özet ve başlat**  
   - Seçilen paket + `currentDayKey` ile başlangıç/bitiş tarihleri hesaplanır (`addDays` mantığı NewCampaignSheet ile aynı).  
   - Tahmini maliyet:  
     `GET /api/player/marketing-pricing-preview?scope=PRODUCT&packageId=<seçilen>&warehouseBuildingId=<data.warehouseId>`  
     (PRODUCT scope’ta listingId zorunlu değil; totalPrice = basePrice.)  
   - **CampaignSummary** kullanılır:  
     `import { CampaignSummary, type SummaryTarget, type SummaryPackage, type SummaryDates } from '@/app/player/marketing/_components/CampaignSummary';`  
     - `target`: `{ type: 'product', productName, warehouseName: warehouseLabel }`  
     - `pkg`: seçilen paketin title, key, positiveBoostPct, durationDays, awarenessGainDec  
     - `dates`: startDayKey = currentDayKey, endDayKey = start + durationDays - 1  
     - `affectedSkus`: 1  
     - `estimatedTotalCost`: pricing-preview’dan gelen totalPrice  
   - "Back" → step 1’e dön.  
   - "Start Campaign" → POST isteği.

4. **Submit**  
   - `POST /api/player/product-marketing-campaigns`  
   - Body: `{ warehouseBuildingId: props.warehouseId, listingId: props.listingId, packageId: selectedPackageId }`  
   - Hata yönetimi NewCampaignSheet ile aynı:  
     - 409 → "Campaign already exists for this product in the selected period." (veya API’den gelen mesaj)  
     - 400 + "insufficient" → "Insufficient funds"  
     - Diğer hatalar → toast error  
   - Başarı: toast success, `onSuccess?.()`, `onOpenChange(false)`.

5. **Kapatma**  
   - Modal kapanırken step ve seçimi sıfırla (onOpenChange(false) veya open false olduğunda reset).

**UI:**

- Dialog (örn. shadcn `Dialog`) kullanılabilir; mevcut NewCampaignSheet ile benzer genişlik/scroll davranışı tercih edilebilir.  
- Footer: Step 1’de sadece "Next" (paket seçili değilse disabled). Step 2’de "Back" + "Start Campaign" (submitting sırasında disabled).

---

## 3. PerformanceDetailClient değişiklikleri

**Dosya:** `app/player/performance/_components/PerformanceDetailClient.tsx`

- **Props:**  
  - Mevcut: `data: PerformanceDetailData`, `backHref: string`.  
  - Yeni (opsiyonel): `currentDayKey?: string`.

- **State:**  
  - `campaignModalOpen: boolean` (default false).

- **Start Campaign butonu:**  
  - Eski: `handleStartCampaign` içinde `router.push(/player/marketing?warehouseId=...&listingId=...)`.  
  - Yeni: `handleStartCampaign` → `setCampaignModalOpen(true)`.

- **Render:**  
  - `<StartProductCampaignModal open={campaignModalOpen} onOpenChange={setCampaignModalOpen} warehouseId={data.warehouseId} listingId={data.listingId} productName={data.productName} warehouseLabel={data.warehouseLabel} currentDayKey={currentDayKey ?? ''} onSuccess={() => { /* istenirse liste/istatistik yenileme */ }} />`  
  - `currentDayKey` yoksa modal yine açılabilir; özet adımında tarih alanları boş veya “—” gösterilebilir (veya currentDayKey zorunlu yapılıp sayfa her zaman geçebilir).

---

## 4. Performance detail sayfası (server)

**Dosya:** `app/player/performance/[playerProductId]/page.tsx`

- `getCompanyGameDayKey(company.id)` çağrılacak (zaten `getPerformanceDetailData` içinde kullanılıyor ama dönmüyor; ayrıca bir kez daha çağrılabilir veya `getPerformanceDetailData` genişletilebilir).  
- En basit yol: sayfada ek bir satırda  
  `const currentDayKey = await getCompanyGameDayKey(company.id);`  
  ve bunu ISO string olarak (veya projede kullanılan dayKey formatında) `PerformanceDetailClient`’a prop olarak vermek.  
- Alternatif: `PerformanceDetailData` tipine `currentDayKey?: string` ekleyip `getPerformanceDetailData` içinde set etmek; böylece tek bir `data` objesi ile iletilir.

---

## 5. Dosya özeti

| Dosya | Değişiklik |
|-------|------------|
| `app/player/performance/_components/StartProductCampaignModal.tsx` | **Yeni.** Modal: paket listesi (step 1) + özet + submit (step 2). Marketing’teki PackageCarousel, PackageCard, CampaignSummary ve mevcut API’ler kullanılır. |
| `app/player/performance/_components/PerformanceDetailClient.tsx` | `currentDayKey` prop ekleme; Start Campaign’e tıklanınca `router.push` yerine modal açma; `StartProductCampaignModal` render. |
| `app/player/performance/[playerProductId]/page.tsx` | `currentDayKey` alıp client’a geçirme (veya `getPerformanceDetailData`’ya ekleyip `data.currentDayKey` kullanma). |

Marketing tarafında (`ProductCampaignForm`, `NewCampaignSheet`, API’ler) değişiklik yok; sadece aynı API’ler ve bileşenler Performance modülünden kullanılacak.

---

## 6. Kısa test senaryosu

1. `/player/performance` listesinden bir ürün seç → detay sayfasına gir.  
2. Warehouse seçili olsun (varsayılan veya değiştirilmiş).  
3. "Start Campaign" butonuna tıkla → Modal açılır, sadece kampanya paketleri (STARTER, BASIC, STANDARD, vb.) görünür.  
4. Bir paket seç → Next → Özet ekranında ürün adı, paket, süre, tahmini maliyet ve tarih aralığı görünür.  
5. "Start Campaign" tıkla → POST gider; başarılıysa toast + modal kapanır.  
6. Aynı ürün/depo için tekrar “Start Campaign” denerse ve aynı dönem çakışıyorsa 409 hatası ve uygun mesaj gösterilir.

Bu plan uygulandığında kampanya tanımlama işlemi Performance detay sayfasından, Marketing sayfasına gitmeden tamamlanmış olur.
