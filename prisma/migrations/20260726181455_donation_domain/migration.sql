-- CreateEnum
CREATE TYPE "DonationProvider" AS ENUM ('TELEGRAM_STARS', 'YOOKASSA', 'STRIPE', 'BOOSTY', 'PATREON', 'CRYPTO');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('CREATED', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "donations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "DonationProvider" NOT NULL,
    "external_payment_id" TEXT,
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "status" "DonationStatus" NOT NULL DEFAULT 'CREATED',
    "reward_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_events" (
    "id" UUID NOT NULL,
    "donation_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_rewards" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "min_amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "donations_user_id_created_at_idx" ON "donations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "donations_status_idx" ON "donations"("status");

-- CreateIndex
CREATE INDEX "donations_provider_external_payment_id_idx" ON "donations"("provider", "external_payment_id");

-- CreateIndex
CREATE INDEX "donation_events_donation_id_created_at_idx" ON "donation_events"("donation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "donation_rewards_code_key" ON "donation_rewards"("code");

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "donation_rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_events" ADD CONSTRAINT "donation_events_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
