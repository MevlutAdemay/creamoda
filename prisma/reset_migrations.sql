-- Extension oluştur
CREATE EXTENSION IF NOT EXISTS "citext";

-- Migration geçmişini temizle (eğer tablo varsa)
DROP TABLE IF EXISTS "_prisma_migrations";
