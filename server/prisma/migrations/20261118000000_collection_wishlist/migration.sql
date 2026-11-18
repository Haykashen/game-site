CREATE TYPE "CollectionStatus" AS ENUM ('acquired','wishlist');
ALTER TABLE copies ADD COLUMN collection_status "CollectionStatus" NOT NULL DEFAULT 'acquired';
CREATE INDEX copies_user_id_collection_status_idx ON copies(user_id,collection_status);
