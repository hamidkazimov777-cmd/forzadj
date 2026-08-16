import { Context, NextFunction } from "grammy";
import { prisma } from "@/server/repositories/prisma";
import type { User } from "@prisma/client";

// Базовый контекст бота. Тип Conversation из @grammyjs/conversations мы добавим позже в основном файле.
export interface AuthContext extends Context {
  user?: User;
}

export async function requireAdmin(ctx: AuthContext, next: NextFunction) {
  if (!ctx.from) return;

  const telegramId = ctx.from.id.toString();
  const isOwner = telegramId === process.env.FORZADJ_OWNER_TELEGRAM_ID;

  let user: User | null = null;

  const identity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: "TELEGRAM",
        providerUserId: telegramId,
      },
    },
    include: { user: true },
  });
  
  if (identity) {
    user = identity.user;
  }

  if (!user && isOwner) {
    user = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  }

  if (user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN")) {
    console.log(`[Auth] Authorized as ${user.id} (${user.role})`);
    ctx.user = user;
    return next();
  }

  console.log(`[Auth] Access denied for Telegram ID: ${telegramId}, user:`, user);
  await ctx.reply("У вас нет прав для использования этого бота.");
}
