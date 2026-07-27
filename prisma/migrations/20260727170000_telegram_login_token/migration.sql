-- CreateEnum
CREATE TYPE "TelegramLoginStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CONSUMED');

-- CreateTable
CREATE TABLE "telegram_login_tokens" (
    "id" UUID NOT NULL,
    "nonce" TEXT NOT NULL,
    "browser_token" TEXT NOT NULL,
    "status" "TelegramLoginStatus" NOT NULL DEFAULT 'PENDING',
    "telegram_user_id" TEXT,
    "telegram_data" JSONB,
    "next_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "telegram_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_login_tokens_nonce_key" ON "telegram_login_tokens"("nonce");
CREATE INDEX "telegram_login_tokens_expires_at_idx" ON "telegram_login_tokens"("expires_at");
