import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { DonationProvider, DonationStatus } from "@/generated/prisma/enums";

/** JSON-коэрция к типу Prisma (JSON.parse даёт any → совместим с InputJsonValue). */
function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Доступ к данным донатов. Журнал (без soft delete). Бизнес-правила и
 * запись событий — в DonationService.
 */
export const donationRepository = {
  create(input: {
    userId: string;
    provider: DonationProvider;
    amountMinor: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.donation.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: "CREATED",
        metadata: toJson(input.metadata),
      },
    });
  },

  findById(id: string) {
    return prisma.donation.findUnique({ where: { id } });
  },

  /** Сверка вебхука: донат по идентификатору платежа провайдера. */
  findByExternalId(provider: DonationProvider, externalPaymentId: string) {
    return prisma.donation.findFirst({
      where: { provider, externalPaymentId },
    });
  },

  /** История донатов пользователя (для будущего UI). */
  listForUser(userId: string, opts?: { skip?: number; take?: number }) {
    return Promise.all([
      prisma.donation.count({ where: { userId } }),
      prisma.donation.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: opts?.skip ?? 0,
        take: opts?.take ?? 50,
        include: { reward: true },
      }),
    ]);
  },

  /** Все заявки для Studio (с автором); по умолчанию — ручные переводы. */
  listAll(opts?: {
    provider?: DonationProvider;
    skip?: number;
    take?: number;
  }) {
    const where = opts?.provider ? { provider: opts.provider } : {};
    return Promise.all([
      prisma.donation.count({ where }),
      prisma.donation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: opts?.skip ?? 0,
        take: opts?.take ?? 100,
        include: {
          user: { select: { displayName: true, avatarUrl: true } },
        },
      }),
    ]);
  },

  update(
    id: string,
    data: {
      status?: DonationStatus;
      externalPaymentId?: string;
      completedAt?: Date | null;
      rewardId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const { metadata, ...rest } = data;
    return prisma.donation.update({
      where: { id },
      data: { ...rest, metadata: toJson(metadata) },
    });
  },

  appendEvent(
    donationId: string,
    type: string,
    payload?: Record<string, unknown>,
  ) {
    return prisma.donationEvent.create({
      data: { donationId, type, payload: toJson(payload) },
    });
  },

  // ─── Каталог наград (место под будущее; выдача не реализована) ──────────
  listActiveRewards() {
    return prisma.donationReward.findMany({
      where: { isActive: true },
      orderBy: { minAmountMinor: "asc" },
    });
  },

  findRewardById(id: string) {
    return prisma.donationReward.findUnique({ where: { id } });
  },
};
