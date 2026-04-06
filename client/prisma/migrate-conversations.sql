DO $$
BEGIN
  BEGIN
    ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_rooms'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) THEN
    ALTER TABLE "chat_rooms" RENAME TO "conversations";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'chatRoomId'
  ) THEN
    ALTER TABLE "messages" RENAME COLUMN "chatRoomId" TO "conversationId";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'content'
  ) THEN
    ALTER TABLE "messages" RENAME COLUMN "content" TO "text";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) THEN
    ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "productId" TEXT;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'orderId'
    ) THEN
      UPDATE "conversations" AS conversations
      SET "productId" = orders."productId"
      FROM "orders" AS orders
      WHERE conversations."orderId" = orders."id"
        AND conversations."productId" IS NULL;

      ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "chat_rooms_orderId_fkey";
      ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_orderId_fkey";
      DROP INDEX IF EXISTS "chat_rooms_orderId_key";
      DROP INDEX IF EXISTS "conversations_orderId_key";
      ALTER TABLE "conversations" DROP COLUMN IF EXISTS "orderId";
    END IF;
  END IF;
END $$;