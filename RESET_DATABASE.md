# Veritabanı Reset Komutları

## ⚠️ DİKKAT: Bu işlem TÜM VERİLERİ SİLER!

## Seçenek 1: Migration Klasörünü Silip Sıfırdan Başla (ÖNERİLEN)

```powershell
# 1. Migration klasörünü sil (eski migration'ları temizle)
Remove-Item -Path "prisma\migrations" -Recurse -Force

# 2. Veritabanını resetle (TÜM TABLOLARI SİLER!)
npx prisma migrate reset --force --skip-seed

# 3. Yeni migration oluştur ve uygula
npx prisma migrate dev --name init

# 4. Prisma Client'ı generate et
npx prisma generate
```

## Seçenek 2: Migration Klasörünü Koruyarak Reset

```powershell
# 1. Sadece veritabanını resetle (migration geçmişi kalır)
npx prisma migrate reset --force --skip-seed

# 2. Prisma Client'ı generate et
npx prisma generate
```

## Seçenek 3: Script Kullan (Otomatik)

```powershell
# PowerShell script'ini çalıştır
.\reset-database.ps1
```

## Adım Adım Açıklama

### Migration Klasörünü Silmek:
- ✅ **Avantaj**: Temiz bir başlangıç, eski migration'lardan kaynaklanan sorunlar olmaz
- ❌ **Dezavantaj**: Migration geçmişi kaybolur (production'da kullanmayın!)

### Migration Klasörünü Korumak:
- ✅ **Avantaj**: Migration geçmişi korunur
- ❌ **Dezavantaj**: Eski migration'lardaki hatalar devam edebilir

## Öneri

**Development ortamında**: Migration klasörünü silip sıfırdan başlamak daha temiz olur.

**Production ortamında**: Migration klasörünü ASLA silmeyin! Sadece `prisma migrate reset` kullanın.
