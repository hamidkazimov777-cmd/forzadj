import { z } from "zod";
import { donationRepository } from "@/server/repositories/donation.repository";
import type { DonationProvider, DonationStatus } from "@/types/db";

/**
 * DonationService — доменная логика донатов, независимая от провайдеров.
 *
 * На MVP: создание записи, переходы статусов с журналированием событий,
 * история пользователя, сопоставление наград (без автовыдачи). Платёжные
 * вызовы (инициация, вебхуки) добавятся через DonationProviderInterface
 * без изменения этого сервиса.
 *
 * Безопасность: userId всегда приходит из серверной сессии (не от клиента);
 * сумма/валюта/провайдер валидируются здесь; статусами управляет только
 * сервер (провайдер/владелец), но не клиент.
 */

const PROVIDERS = [
  "TELEGRAM_STARS",
  "YOOKASSA",
  "STRIPE",
  "BOOSTY",
  "PATREON",
  "CRYPTO",
] as const;

const createDonationSchema = z.object({
  provider: z.enum(PROVIDERS),
  /** Сумма в минорных единицах (копейки/центы; для Stars — число звёзд). */
  amountMinor: z.number().int().positive().max(100_000_000),
  currency: z.string().trim().min(3).max(8).toUpperCase(),
});

export interface CreateDonationInput {
  provider: DonationProvider;
  amountMinor: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

/** Терминальные статусы — после них переходы не выполняются. */
const TERMINAL: ReadonlySet<DonationStatus> = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]);

export const donationService = {
  /**
   * Создать намерение доната (статус CREATED). Платёж НЕ инициируется —
   * это сделает провайдер-адаптер в будущем. Пишет событие "created".
   */
  async createDonation(userId: string, input: CreateDonationInput) {
    const parsed = createDonationSchema.parse(input);
    const donation = await donationRepository.create({
      userId,
      provider: parsed.provider,
      amountMinor: parsed.amountMinor,
      currency: parsed.currency,
      metadata: input.metadata,
    });
    await donationRepository.appendEvent(donation.id, "created");
    return donation;
  },

  /**
   * Перевести донат в новый статус с журналированием. Вызывается сервером
   * (будущий обработчик вебхука/владелец), не клиентом. Идемпотентно
   * защищает от переходов из терминального статуса.
   */
  async transitionStatus(
    donationId: string,
    status: DonationStatus,
    opts?: {
      externalPaymentId?: string;
      payload?: Record<string, unknown>;
    },
  ) {
    const donation = await donationRepository.findById(donationId);
    if (!donation) throw new Error("Donation not found");
    if (TERMINAL.has(donation.status)) {
      // Уже в финальном статусе — повторные события игнорируем (журналируем).
      await donationRepository.appendEvent(
        donationId,
        `ignored:${status}`,
        opts?.payload,
      );
      return donation;
    }

    const updated = await donationRepository.update(donationId, {
      status,
      externalPaymentId: opts?.externalPaymentId,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    });
    await donationRepository.appendEvent(
      donationId,
      `status:${status}`,
      opts?.payload,
    );
    return updated;
  },

  /** История донатов пользователя (для будущего UI кабинета). */
  getUserHistory(userId: string, opts?: { skip?: number; take?: number }) {
    return donationRepository.listForUser(userId, opts);
  },

  /**
   * Подобрать награду под сумму (место под будущее). Возвращает подходящую
   * активную награду или null. НИЧЕГО не выдаёт и не сохраняет — только
   * вычисляет; фактическая выдача появится позже.
   */
  async matchReward(
    amountMinor: number,
    currency: string,
  ): Promise<{ id: string; code: string } | null> {
    const rewards = await donationRepository.listActiveRewards();
    const eligible = rewards
      .filter((r) => r.currency === currency && amountMinor >= r.minAmountMinor)
      .sort((a, b) => b.minAmountMinor - a.minAmountMinor);
    return eligible[0] ? { id: eligible[0].id, code: eligible[0].code } : null;
  },
};
