CREATE TABLE "copy_shares" (
 "id" UUID NOT NULL, "copy_id" UUID NOT NULL, "caption" TEXT NOT NULL DEFAULT '',
 "photos" TEXT[] NOT NULL, "condition" TEXT NOT NULL, "completeness" TEXT NOT NULL, "region" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "copy_shares_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "copy_shares_copy_id_fkey" FOREIGN KEY ("copy_id") REFERENCES "copies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "copy_shares_copy_id_key" ON "copy_shares"("copy_id");
CREATE INDEX "copy_shares_created_at_id_idx" ON "copy_shares"("created_at", "id");
