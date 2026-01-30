# Manuel Neon SQL – ModaverseSettlement ledger alanlarını kaldırma

Schema artık `postedLedgerEntryId` ve `postedAt` kullanmıyor. **Veritabanını resetlemeden** sadece bu sütunları kaldırmak için:

1. Önce `npx prisma db push` dene. Push bu sütunları kaldıracak şekilde DDL üretebilir.
2. Push hata verirse veya sen manuel yapmak istersen Neon SQL Editor’da aşağıdakileri **sırayla** çalıştır:

```sql
-- ModaverseSettlement: ledger referansını kaldır (settlement kaydında ledger id tutmuyoruz)
ALTER TABLE "modaverse_settlements" DROP CONSTRAINT IF EXISTS "modaverse_settlements_postedLedgerEntryId_fkey";
DROP INDEX IF EXISTS "modaverse_settlements_postedLedgerEntryId_idx";
ALTER TABLE "modaverse_settlements" DROP COLUMN IF EXISTS "postedLedgerEntryId";
ALTER TABLE "modaverse_settlements" DROP COLUMN IF EXISTS "postedAt";
```

Bundan sonra `npx prisma db push` veya `npx prisma generate` ile devam edebilirsin.
