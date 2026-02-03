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
