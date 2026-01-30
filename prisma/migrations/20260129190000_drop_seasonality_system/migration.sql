-- DropSeasonalitySystem: Remove SeasonalityProfile, SeasonalityKeyframe, SeasonWindowConfig and all relations.
-- Apply this on Neon manually if migrate deploy is not used, or drop the tables manually.

-- Drop foreign keys (constraint names may vary; try both common patterns)
ALTER TABLE "product_templates" DROP CONSTRAINT IF EXISTS "product_templates_seasonality_profile_id_fkey";
ALTER TABLE "product_templates" DROP CONSTRAINT IF EXISTS "product_templates_seasonalityProfileId_fkey";

ALTER TABLE "player_products" DROP CONSTRAINT IF EXISTS "player_products_seasonality_profile_override_id_fkey";
ALTER TABLE "player_products" DROP CONSTRAINT IF EXISTS "player_products_seasonalityProfileOverrideId_fkey";

-- Drop indexes (optional; dropping column often drops the index in PostgreSQL)
DROP INDEX IF EXISTS "product_templates_seasonality_profile_id_idx";
DROP INDEX IF EXISTS "ProductTemplate_seasonalityProfileId_idx";
DROP INDEX IF EXISTS "player_products_seasonality_profile_override_id_idx";
DROP INDEX IF EXISTS "PlayerProduct_seasonalityProfileOverrideId_idx";

-- Drop columns
ALTER TABLE "product_templates" DROP COLUMN IF EXISTS "seasonality_profile_id";
ALTER TABLE "player_products" DROP COLUMN IF EXISTS "seasonality_profile_override_id";

-- Drop tables (keyframes reference profiles; drop keyframes first)
DROP TABLE IF EXISTS "seasonality_keyframes";
DROP TABLE IF EXISTS "seasonality_profiles";
DROP TABLE IF EXISTS "season_window_configs";
