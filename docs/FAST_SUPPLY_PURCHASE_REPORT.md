# Fast Supply Satın Alma – İş Akışı ve Veritabanı Raporu

Bu rapor, **Design Studio Fast Supply** satın alma işleminin baştan sona nasıl çalıştığını, hangi tablolara ne yazıldığını ve alan eşlemesini açıklar.

---

## 1. Genel Özet

| Aşama | Açıklama |
|-------|----------|
| **Tetikleyici** | Kullanıcı `StudioFastSupplyClient` içinde sepete ürün ekleyip "Purchase" ile satın alır. |
| **API** | `POST /api/player/fast-supply-purchase` çağrılır. |
| **İşlem** | Tek bir **Prisma transaction** içinde: sipariş oluşturma, ürün kilidi, stok güncelleme, hareket kaydı, muhasebe (ledger) ve cüzdan güncellemesi yapılır. |
| **Sonuç** | Ürünler seçilen depoya stok olarak eklenir; USD bakiyesi düşer, XP ödülü (varsa) eklenir. |

---

## 2. İstemci Tarafı (Frontend)

**Dosya:** `components/player/designoffices/StudioFastSupplyClient.tsx` (satır 156–185)

### 2.1 Akış

1. **Ön koşullar:** `companyId`, `cart.length > 0`, `selectedWarehouseId` dolu olmalı.
2. **Idempotency key:**  
   `fast-supply:${studioId}:${selectedWarehouseId}:${Date.now()}:${cart satırları}` ile oluşturulur.
3. **İstek gövdesi:**
   - `studioId` – Design Studio ID
   - `warehouseBuildingId` – Hedef depo (CompanyBuilding, role=WAREHOUSE)
   - `lines` – `[{ productTemplateId, qty }, ...]`
   - `idempotencyKey` – (isteğe bağlı, yoksa API üretir)
4. **Başarı sonrası:** Sepet temizlenir, drawer kapanır, toast gösterilir, `router.refresh()` ile sayfa yenilenir.

### 2.2 Kısıtlar (istemci tarafında)

- Satır başı **minimum qty:** `MIN_QTY = 20`.
- Birim maliyet: `ProductTemplate.baseCost * DesignStudio.fastSupplyMultiplier`.

---

## 3. API Tarafı – Doğrulama ve Hazırlık

**Dosya:** `app/api/player/fast-supply-purchase/route.ts`

### 3.1 Auth ve Girdi Kontrolü

| Adım | Kontrol | Hata |
|------|--------|------|
| 1 | `getServerSession()` → `session?.user?.id` | 401 Unauthorized |
| 2 | `studioId`, `lines` (dolu dizi), `warehouseBuildingId` | 400 |
| 3 | Her satır: `productTemplateId` + `qty >= 20` | 400 |
| 4 | `Company` (playerId = userId) | 404 Company not found |
| 5 | `CompanyBuilding` (id = warehouseBuildingId, companyId) + role = WAREHOUSE | 404 / 403 |
| 6 | `DesignStudio` (id = studioId) | 404 |
| 7 | Tüm `productTemplateId` değerleri `ProductTemplate` tablosunda | 404 |
| 8 | `PlayerWallet.balanceUsd >= totalAmount` | 400 Insufficient USD |

### 3.2 Hesaplanan Değerler

- **dayKey:** `getCompanyGameDayKey(companyId)` → `CompanyGameClock.currentDayKey` (UTC midnight).
- **Birim maliyet:** `ProductTemplate.baseCost * DesignStudio.fastSupplyMultiplier`.
- **Satır toplamı:** `unitCost * qty`; tüm satırların toplamı `totalAmount`.
- **Idempotency:** İstekte gönderilmezse `generateIdempotencyKey('FAST_SUPPLY', companyId, studioId, warehouseBuildingId, JSON.stringify(lines))` ile üretilir.

---

## 4. Transaction İçi İşlem Sırası ve Tablolar

Tüm aşağıdaki adımlar **tek `prisma.$transaction`** içinde (timeout 20 sn) çalışır.

### 4.1 PlayerProduct (şirket + şablon bazlı ürün)

**Tablo:** `player_products` (model: `PlayerProduct`)

| İşlem | Açıklama |
|-------|----------|
| **Ne yapılıyor** | Her satır için `companyId` + `productTemplateId` ile **upsert**. |
| **Create alanları** | `companyId`, `productTemplateId`, `displayName` (template.name), `baseCostOverride`, `suggestedPriceOverride`, `launchedAtDayKey` (dayKey), `isUnlocked: true`, `unlockedAt`, `unlockMethod`, `unlockCostXp`, `unlockCostDiamond`. |
| **Update alanları** | `isUnlocked: true`, `unlockedAt`, `unlockMethod`, `unlockCostXp`, `unlockCostDiamond`. |
| **Unique key** | `companyId_productTemplateId`. |

Ürün daha önce yoksa oyuncu havuzuna eklenir; varsa unlock bilgisi güncellenir.

---

### 4.2 PlayerProductImage (görsel kilidi)

**Tablo:** `player_product_images` (model: `PlayerProductImage`)

| İşlem | Açıklama |
|-------|----------|
| **Ne yapılıyor** | Her `ProductTemplate` için ilgili `ProductImageTemplate` kayıtları üzerinden **upsert**. |
| **Unique key** | `playerProductId_productImageTemplateId`. |
| **Create/Update** | `playerProductId`, `productImageTemplateId`, `isUnlocked` (ALWAYS ise true), `unlockedAt`, `unlockMethod`, `paidXp`, `paidDiamond`. |

Fast supply ile gelen ürünün görselleri de “unlock” edilmiş sayılır.

---

### 4.3 WholesaleOrder + WholesaleOrderLine (sipariş)

**Tablo:** `wholesale_orders` (model: `WholesaleOrder`)

| Alan | Değer |
|------|--------|
| `companyId` | Şirket ID |
| `warehouseBuildingId` | Seçilen depo bina ID |
| `studioId` | Design Studio ID |
| `status` | `WholesaleOrderStatus.PAID` |
| `totalCost` | Satır toplamları toplamı (Decimal) |
| `vat` | 0 |
| `totalAmount` | totalCost + vat |
| `awardXp` | 100 |
| `paidAt` | İşlem anı (now) |

**Tablo:** `wholesale_order_lines` (model: `WholesaleOrderLine`)

Her satır için bir kayıt:

| Alan | Değer |
|------|--------|
| `orderId` | Oluşturulan WholesaleOrder.id |
| `productTemplateId` | Şablon ID |
| `productCode` | Snapshot: template.code |
| `productName` | Snapshot: template.name |
| `qty` | Miktar |
| `unitCost` | Birim maliyet (Decimal) |
| `lineTotal` | unitCost * qty |

Sipariş anında **PAID** olarak oluşturulur; ayrıca bir ödeme onay adımı yok.

---

### 4.4 BuildingInventoryItem (depo stok kartı)

**Tablo:** `building_inventory_items` (model: `BuildingInventoryItem`)

| İşlem | Açıklama |
|-------|----------|
| **Unique key** | `companyBuildingId_productTemplateId` (depo + şablon). |
| **Var olan kayıt** | `qtyOnHand` artırılır; `avgUnitCost` ağırlıklı ortalama ile güncellenir; `lastUnitCost` = bu hareketin birim maliyeti; `playerProductId` set edilir. |
| **Yoksa** | Yeni kayıt: `companyBuildingId`, `productTemplateId`, `playerProductId`, `qtyOnHand` = bu hareketin miktarı, `qtyReserved` = 0, `avgUnitCost` = `lastUnitCost` = birim maliyet. |

Böylece ürünler **seçilen depoya stok olarak** eklenir (veya mevcut stok artırılır).

---

### 4.5 InventoryMovement (stok hareketi – audit)

**Tablo:** `inventory_movements` (model: `InventoryMovement`)

Her satır için **bir IN hareketi** yazılır:

| Alan | Değer |
|------|--------|
| `companyBuildingId` | warehouseBuildingId |
| `productTemplateId` | Şablon ID |
| `playerProductId` | İlgili PlayerProduct.id |
| `movementType` | `InventoryMovementType.IN` |
| `sourceType` | `InventorySourceType.FAST_SUPPLY` |
| `sourceRefId` | WholesaleOrder.id |
| `qtyChange` | Satır miktarı (pozitif) |
| `unitCost` | Birim maliyet (Decimal) |
| `dayKey` | Oyun günü (UTC midnight) |

Stok girişinin nedenini (fast supply + hangi sipariş) raporlama ve denetim için saklar.

---

### 4.6 CompanyLedgerEntry + PlayerWallet (USD çıkışı)

**Tablo:** `company_ledger_entries` (model: `CompanyLedgerEntry`)

**Helper:** `postLedgerEntryAndUpdateWallet(tx, userId, { ... })`

| Alan | Değer |
|------|--------|
| `companyId` | Şirket ID |
| `dayKey` | Oyun günü |
| `direction` | `FinanceDirection.OUT` |
| `amountUsd` | totalAmountFinal (toplam ödeme) |
| `category` | `FinanceCategory.WHOLESALE` |
| `scopeType` | `FinanceScopeType.BUILDING` |
| `scopeId` | warehouseBuildingId |
| `counterpartyType` | `FinanceCounterpartyType.SUPPLIER` |
| `counterpartyId` | studioId |
| `refType` | `'WHOLESALE_ORDER'` |
| `refId` | WholesaleOrder.id |
| `idempotencyKey` | `${idempotencyKey}:ledger` |
| `note` | `'WHOLESALE'` |

- **Idempotency:** Aynı `idempotencyKey` ile tekrar çağrıda **yeni ledger satırı yazılmaz** (mevcut döndürülür).
- **Cüzdan:** Sadece **yeni** oluşturulan ledger kaydı için `PlayerWallet.balanceUsd` **azaltılır** (`updateWalletUsdFromLedger` → `balanceUsd: { increment: -amountUsd }`).

**Tablo:** `player_wallets` (model: `PlayerWallet`)

- Güncellenen alan: `balanceUsd` (OUT hareketi ile düşer).

---

### 4.7 PlayerWalletTransaction + PlayerWallet (XP ödülü)

**Tablo:** `player_wallet_transactions` (model: `PlayerWalletTransaction`)

**Helper:** `postWalletTransactionAndUpdateBalance(tx, { ... })`

| Alan | Değer |
|------|--------|
| `userId` | Oturum açan kullanıcı ID |
| `companyId` | Şirket ID |
| `dayKey` | Oyun günü |
| `currency` | `WalletCurrency.XP` |
| `direction` | `WalletDirection.IN` |
| `amount` | order.awardXp (100) |
| `category` | `WalletTxnCategory.REWARD` |
| `refType` | `'WholesaleOrder'` |
| `refId` | WholesaleOrder.id |
| `idempotencyKey` | `${idempotencyKey}:XP_AWARD` |
| `note` | `'FAST_SUPPLY award XP'` |

- **Idempotency:** Aynı key ile tekrar çağrıda yeni transaction yazılmaz.
- **Cüzdan:** Sadece yeni transaction yazıldığında `PlayerWallet.balanceXp` artırılır.

**Tablo:** `player_wallets`

- Güncellenen alan: `balanceXp` (IN hareketi ile artar).

---

## 5. Tablo Özeti (Yazma Eksenli)

| Sıra | Tablo (Prisma model) | İşlem | Açıklama |
|------|----------------------|--------|----------|
| 1 | `player_products` (PlayerProduct) | Upsert | Şirket + şablon bazlı ürün / unlock |
| 2 | `player_product_images` (PlayerProductImage) | Upsert | Ürün görsel kilidi |
| 3 | `wholesale_orders` (WholesaleOrder) | Create | Sipariş (PAID) |
| 4 | `wholesale_order_lines` (WholesaleOrderLine) | Create | Sipariş satırları |
| 5 | `building_inventory_items` (BuildingInventoryItem) | Create veya Update | Depo stok miktarı / ortalama maliyet |
| 6 | `inventory_movements` (InventoryMovement) | Create | Her satır için IN hareketi (FAST_SUPPLY) |
| 7 | `company_ledger_entries` (CompanyLedgerEntry) | Create (idempotent) | USD çıkış kaydı |
| 8 | `player_wallets` (PlayerWallet) | Update | balanceUsd azalır |
| 9 | `player_wallet_transactions` (PlayerWalletTransaction) | Create (idempotent) | XP ödülü |
| 10 | `player_wallets` (PlayerWallet) | Update | balanceXp artar |

**Okuma yapılan tablolar (transaction dışında):**  
`User` (session), `Company`, `CompanyBuilding`, `DesignStudio`, `ProductTemplate`, `PlayerWallet` (bakiye kontrolü), `CompanyGameClock` (dayKey).

---

## 6. İlişki ve Referanslar

- **WholesaleOrder** → `companyId`, `warehouseBuildingId`, `studioId`.
- **WholesaleOrderLine** → `orderId`, `productTemplateId`.
- **BuildingInventoryItem** → `companyBuildingId`, `productTemplateId`, `playerProductId`.
- **InventoryMovement** → `companyBuildingId`, `productTemplateId`, `playerProductId`, `sourceRefId` = WholesaleOrder.id.
- **CompanyLedgerEntry** → `companyId`, `refId` = WholesaleOrder.id, `scopeId` = warehouseBuildingId, `counterpartyId` = studioId.
- **PlayerWalletTransaction** → `userId`, `refId` = WholesaleOrder.id.

---

## 7. Idempotency

- **Ledger:** `idempotencyKey` = `${clientKey}:ledger`. Aynı key ile ikinci istekte yeni ledger satırı oluşturulmaz, bakiye tekrar düşürülmez.
- **XP:** `idempotencyKey` = `${clientKey}:XP_AWARD`. Aynı key ile ikinci istekte yeni wallet transaction oluşturulmaz, XP tekrar eklenmez.
- Sipariş / stok / hareket: Idempotency key kullanılmaz; her istek yeni WholesaleOrder, yeni InventoryMovement ve BuildingInventoryItem güncellemesi üretir. Bu yüzden **istemci aynı idempotencyKey ile tekrar göndermeli** (örn. hata sonrası retry); API tarafında sipariş tekrarı engellemek için ek mantık yok.

---

## 8. Özet Akış Şeması (Metin)

```
[StudioFastSupplyClient] handlePurchase
    → POST /api/player/fast-supply-purchase
        → Auth + validasyon (company, warehouse, studio, templates, bakiye)
        → getCompanyGameDayKey(companyId)
        → prisma.$transaction:
            1) PlayerProduct upsert (her satır)
            2) PlayerProductImage upsert (her template görseli)
            3) WholesaleOrder create + WholesaleOrderLine create
            4) BuildingInventoryItem update veya create (stok artışı)
            5) InventoryMovement create (IN, FAST_SUPPLY, sourceRefId = order.id)
            6) postLedgerEntryAndUpdateWallet → CompanyLedgerEntry + PlayerWallet.balanceUsd
            7) postWalletTransactionAndUpdateBalance (XP) → PlayerWalletTransaction + PlayerWallet.balanceXp
        → 200 { success, orderId, balanceUsd, balanceXp, affectedProductTemplateIds }
    → setCart([]), setDrawerOpen(false), toast, router.refresh()
```

Bu doküman, mevcut kod ve şemaya göre fast supply satın alma işleminin tüm aşamalarını ve veritabanına yazılan tablo/alanları özetler.
