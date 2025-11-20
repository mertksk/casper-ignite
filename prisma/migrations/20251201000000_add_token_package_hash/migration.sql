-- Add tokenPackageHash for storing the CEP-18 package hash (preferred for transfers).
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "tokenPackageHash" TEXT;
