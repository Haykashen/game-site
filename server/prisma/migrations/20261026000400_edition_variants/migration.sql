ALTER TABLE "editions" ADD COLUMN "canonical_id" TEXT;
CREATE INDEX "editions_canonical_id_idx" ON "editions"("canonical_id");
ALTER TABLE "editions" ADD CONSTRAINT "editions_canonical_id_fkey"
  FOREIGN KEY ("canonical_id") REFERENCES "editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "editions" ADD CONSTRAINT "editions_canonical_not_self"
  CHECK ("canonical_id" IS NULL OR "canonical_id" <> "id");
