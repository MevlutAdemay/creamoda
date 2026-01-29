# Veritabanını sıfırdan oluşturma scripti
# Bu script tüm tabloları siler ve yeni migration oluşturur

Write-Host "=== Veritabanı Reset İşlemi ===" -ForegroundColor Yellow

# 1. Migration klasörünü sil (eski migration'ları temizle)
Write-Host "`n1. Eski migration klasörü siliniyor..." -ForegroundColor Cyan
if (Test-Path "prisma\migrations") {
    Remove-Item -Path "prisma\migrations" -Recurse -Force
    Write-Host "   ✓ Migration klasörü silindi" -ForegroundColor Green
} else {
    Write-Host "   ✓ Migration klasörü zaten yok" -ForegroundColor Green
}

# 2. Prisma Client'ı temizle
Write-Host "`n2. Prisma Client temizleniyor..." -ForegroundColor Cyan
npx prisma generate --schema=./prisma/schema.prisma
Write-Host "   ✓ Prisma Client güncellendi" -ForegroundColor Green

# 3. Veritabanını resetle (TÜM TABLOLARI SİLER!)
Write-Host "`n3. Veritabanı resetleniyor (TÜM TABLOLAR SİLİNECEK!)..." -ForegroundColor Red
Write-Host "   ⚠ DİKKAT: Bu işlem geri alınamaz!" -ForegroundColor Yellow
$confirm = Read-Host "   Devam etmek istiyor musunuz? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "   İşlem iptal edildi." -ForegroundColor Yellow
    exit
}

npx prisma migrate reset --force --skip-seed
Write-Host "   ✓ Veritabanı resetlendi" -ForegroundColor Green

# 4. Yeni migration oluştur
Write-Host "`n4. Yeni migration oluşturuluyor..." -ForegroundColor Cyan
npx prisma migrate dev --name init --create-only
Write-Host "   ✓ Migration oluşturuldu" -ForegroundColor Green

# 5. Migration'ı uygula
Write-Host "`n5. Migration uygulanıyor..." -ForegroundColor Cyan
npx prisma migrate deploy
Write-Host "   ✓ Migration uygulandı" -ForegroundColor Green

# 6. Prisma Client'ı tekrar generate et
Write-Host "`n6. Prisma Client generate ediliyor..." -ForegroundColor Cyan
npx prisma generate --schema=./prisma/schema.prisma
Write-Host "   ✓ Prisma Client generate edildi" -ForegroundColor Green

Write-Host "`n=== İşlem Tamamlandı ===" -ForegroundColor Green
Write-Host "Veritabanı sıfırdan oluşturuldu!" -ForegroundColor Green
