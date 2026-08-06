import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { SupportCategory } from "@/generated/prisma/enums";

/** JSON-коэрция к типу Prisma (совместимо с InputJsonValue). */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Доступ к данным обращений в поддержку. Журнал (без soft delete). Тикет
 * сохраняется здесь (стабильный ID + аудит) и дублируется в Telegram-бот
 * поддержки серверным экшеном support.actions.
 */
export const supportRepository = {
  create(input: {
    userId?: string | null;
    name: string;
    email: string;
    telegram?: string | null;
    category: SupportCategory;
    subject: string;
    message: string;
    attachments?: string[];
  }) {
    return prisma.supportTicket.create({
      data: {
        userId: input.userId ?? null,
        name: input.name,
        email: input.email,
        telegram: input.telegram ?? null,
        category: input.category,
        subject: input.subject,
        message: input.message,
        attachments: toJson(input.attachments),
        status: "OPEN",
      },
    });
  },

  findById(id: string) {
    return prisma.supportTicket.findUnique({ where: { id } });
  },

  listForUser(userId: string, opts?: { skip?: number; take?: number }) {
    return prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: opts?.skip ?? 0,
      take: opts?.take ?? 50,
    });
  },
};
