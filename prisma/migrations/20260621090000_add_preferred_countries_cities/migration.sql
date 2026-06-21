ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "preferredCountries" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "preferredCities" TEXT[] NOT NULL DEFAULT '{}';
