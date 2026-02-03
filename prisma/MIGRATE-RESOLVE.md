# Prisma P3009: Failed migration resolve

Vercel deploy fails with:

```
Error: P3009
migrate found failed migrations in the target database, new migrations will not be applied.
The `20260129200000_modaverse_settlement_v02_and_orders` migration failed
```

**Veritabanı resetlenmez.** `prisma migrate resolve` sadece `_prisma_migrations` tablosundaki ilgili kaydın durumunu (failed → applied veya rolled_back) günceller; hiçbir tabloyu silmez veya veriyi değiştirmez.

---

## Hızlı çözüm (reset yok)

Production DB’de migration’ın yarım kalmış veya tamamlanmış olmasına göre **tek komut** yeterli:

```bash
# Production DATABASE_URL'yi Vercel → Settings → Environment Variables'tan kopyala
set DATABASE_URL=postgresql://...   # Windows CMD
# export DATABASE_URL="postgresql://..."   # PowerShell / Mac/Linux

npx prisma migrate resolve --applied "20260129200000_modaverse_settlement_v02_and_orders"
```

Sonra Vercel’da tekrar deploy et. Veri silinmez, tablolar resetlenmez.

---

## Option A: Mark migration as applied (DB already correct)

If the production database is already in the correct state (you fixed it manually, or the migration actually completed but was marked failed), mark it as applied so future deploys can continue:

```bash
# Use your production DATABASE_URL (from Vercel env or Neon dashboard)
export DATABASE_URL="postgresql://...?sslmode=require"

npx prisma migrate resolve --applied "20260129200000_modaverse_settlement_v02_and_orders"
```

Then trigger a new Vercel deploy.

## Option B: Mark as rolled back and retry

If you want the migration to run again on next deploy (e.g. you reverted the DB or fixed the migration):

```bash
export DATABASE_URL="postgresql://...?sslmode=require"

npx prisma migrate resolve --rolled-back "20260129200000_modaverse_settlement_v02_and_orders"
```

Then redeploy. `prisma migrate deploy` will re-run this migration and the next one(s).

## Getting production DATABASE_URL

- **Vercel:** Project → Settings → Environment Variables → `DATABASE_URL`
- **Neon:** Dashboard → your project → Connection string (with pooler if you use it)

Run the command from your machine (or a one-off script) with this URL; do not commit it.

---

## P3008: "Migration is already recorded as applied"

If you see:

```
Error: P3008
The migration `...` is already recorded as applied in the database.
```

Bu hata, o migration'ın zaten veritabanında **applied** olarak işaretli olduğu anlamına gelir. Tekrar `resolve --applied` çalıştırmana gerek yok; sorun çözülmüş demektir.

**Bekleyen yeni migration'ları uygulamak için** (ör. wholesale_supplier_and_catalog):

```bash
# Production DATABASE_URL ile
npx prisma migrate deploy
```

`migrate deploy` sadece henüz uygulanmamış migration'ları çalıştırır; zaten applied olanlara dokunmaz.

---

## Yeni migration failed oldu (P3009, örn. wholesale_supplier_and_catalog)

1. Failed state'i kaldır (migration'ı "rolled back" say, böylece tekrar denenecek):

```bash
npx prisma migrate resolve --rolled-back "20260129220000_wholesale_supplier_and_catalog"
```

2. Sonra tekrar deploy et:

```bash
npx prisma migrate deploy
```

Migration SQL'i idempotent (IF NOT EXISTS) yapıldıysa, tablolar kısmen oluşmuş olsa bile tekrar çalıştırma güvenlidir.

---

## P3015: "Could not find the migration file at migration.sql"

Bu hata, Prisma’nın bir migration klasöründe `migration.sql` dosyasını bulamadığı anlamına gelir.

**Kontrol et:**
1. Komutu **proje kökünden** (örn. `C:\V01modaverse\creamoda`) çalıştırıyorsun:
   ```bash
   cd C:\V01modaverse\creamoda
   npx prisma migrate deploy
   ```
2. Her migration klasöründe `migration.sql` var mı?
   ```bash
   dir prisma\migrations\20260129220000_wholesale_supplier_and_catalog
   ```
   Çıktıda `migration.sql` görünmeli.
3. "6 migrations found" ama diskte 4 klasör varsa: veritabanındaki `_prisma_migrations` tablosunda eski/yanlış kayıt olabilir. Eksik klasörü silmeyin. sadece ilgili migration’ın dosyasının `prisma/migrations/<isim>/migration.sql` yolunda olduğundan emin olun.
