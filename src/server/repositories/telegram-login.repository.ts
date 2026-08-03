import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Одноразовые токены входа через Telegram-бота (deep-link login).
 * Короткоживущие, single-use. Подтверждение приходит от webhook бота.
 */
export const telegramLoginRepository = {
  create(input: {
    nonce: string;
    browserToken: string;
    nextPath: string | null;
    expiresAt: Date;
  }) {
    return prisma.telegramLoginToken.create({ data: input });
  },

  findByNonce(nonce: string) {
    return prisma.telegramLoginToken.findUnique({ where: { nonce } });
  },

  /**
   * Подтвердить вход по nonce (вызывает webhook бота). Только из PENDING и
   * пока не истёк. Возвращает, было ли подтверждено (false — nonce неизвестен,
   * истёк или уже использован).
   */
  async confirm(
    nonce: string,
    telegramUserId: string,
    telegramData: Prisma.InputJsonValue,
  ): Promise<boolean> {
    const res = await prisma.telegramLoginToken.updateMany({
      where: { nonce, status: "PENDING", expiresAt: { gt: new Date() } },
      data: { status: "CONFIRMED", telegramUserId, telegramData },
    });
    return res.count > 0;
  },

  markConsumed(id: string) {
    return prisma.telegramLoginToken.update({
      where: { id },
      data: { status: "CONSUMED" },
    });
  },

  /** Чистка протухших токенов (вызывается оппортунистически при создании). */
  deleteExpired() {
    return prisma.telegramLoginToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  },
};
