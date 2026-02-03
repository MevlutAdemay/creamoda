# Migration history uyumsuz: "Local migration history and the migrations table from your database are different"

**Belirti:** `prisma migrate status` çıktısı:
- "The last common migration is: null"
- "The migrations from the database are not found locally: 20260125145143_init, 20260128000000_add_country_id_to_company_building"
- "The migrations have not yet been applied: 20260129185715_drop_seasonality_system, 20260130100000_modaverse_settlement_remove_ledger_ref"

Yani DB'deki migration kayıtları repodaki `prisma/migrations` klasör isimleriyle eşleşmiyor. Bu yüzden `migrate deploy` çalışmıyor.

---

## Çözüm (baseline)

### 1. DB'de repoda olmayan kayıtları sil

Neon Dashboard → SQL Editor (veya psql) ile **production** DB'ye bağlanıp çalıştır:

```sql
DELETE FROM _prisma_migrations
WHERE migration_name IN (
  '20260125145143_init',
  '20260128000000_add_country_id_to_company_building'
);
```

Bu, repoda dosyası olmayan eski migration kayıtlarını kaldırır. **Hiçbir tablo veya veri silinmez.**

### 2. Repodaki migration klasör isimlerini kontrol et

```powershell
dir C:\V01modaverse\creamoda\prisma\migrations
```

Bu repoda 4 klasör var:
- `20260129190000_drop_seasonality_system`
- `20260129200000_modaverse_settlement_v02_and_orders`
- `20260129210000_modaverse_order_item_sort_index`
- `20260129220000_wholesale_supplier_and_catalog`

DB şeması zaten ilk üç migration’a göre güncelse (modaverse_settlements, modaverse_order_items vb. tablolar varsa), bu üçünü “applied” olarak işaretle:

### 3. Zaten uygulanmış migration'ları "applied" say

```powershell
cd C:\V01modaverse\creamoda

npx prisma migrate resolve --applied "20260129190000_drop_seasonality_system"
npx prisma migrate resolve --applied "20260129200000_modaverse_settlement_v02_and_orders"
npx prisma migrate resolve --applied "20260129210000_modaverse_order_item_sort_index"
```

(DATABASE_URL production DB’yi göstermeli; .env’de veya ortam değişkeninde.)

### 4. Kalan migration'ı uygula

```powershell
npx prisma migrate deploy
```

Böylece sadece `20260129220000_wholesale_supplier_and_catalog` çalışır ve wholesale tabloları oluşur.

---

**Özet:** Önce DB’den repoda olmayan 2 migration kaydını sil (SQL), sonra repodaki ilk 3 migration’ı `resolve --applied` ile işaretle, en son `migrate deploy` ile sadece wholesale migration’ı uygula.
