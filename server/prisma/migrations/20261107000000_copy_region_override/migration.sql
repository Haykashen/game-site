-- A personal copy can override its edition region without modifying the catalog.
ALTER TABLE "copies" ADD COLUMN "region_override" TEXT;
