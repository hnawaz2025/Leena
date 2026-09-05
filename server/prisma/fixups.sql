-- Explicit, intentional schema changes that `prisma db push` will not make on
-- its own because they destroy data.
--
-- This file exists so those changes are stated, reviewed and committed --
-- rather than granted blanket permission via `--accept-data-loss`, which
-- would let ANY future drift silently delete a column full of real user data.
--
-- Every statement must be idempotent (IF EXISTS / IF NOT EXISTS): this runs on
-- every boot, and must be a no-op once applied.

-- 2026-09: Leena stopped storing the text of users' documents. The contents of
-- someone's lease or immigration notice is the most sensitive thing the app
-- touches, and the strongest version of "we don't keep it" is a database that
-- cannot. See the Document model in schema.prisma.
ALTER TABLE "Document" DROP COLUMN IF EXISTS "extractedText";
