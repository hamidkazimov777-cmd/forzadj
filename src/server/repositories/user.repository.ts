import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthProvider, UserRole } from "@/generated/prisma/enums";

export const userRepository = {
  setRole(userId: string, role: UserRole) {
    return prisma.user.update({ where: { id: userId }, data: { role } });
  },

  findBySupabaseUserId(supabaseUserId: string) {
    return prisma.user.findFirst({ where: { supabaseUserId } });
  },

  findByIdentity(provider: AuthProvider, providerUserId: string) {
    return prisma.user.findFirst({
      where: {
        identities: { some: { provider, providerUserId } },
      },
    });
  },

  findById(id: string) {
    return prisma.user.findFirst({ where: { id } });
  },

  /** Список пользователей для Studio (управление ролями). */
  listUsers(opts?: { take?: number; skip?: number }) {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: opts?.take ?? 100,
      skip: opts?.skip ?? 0,
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        bannedAt: true,
        lastLoginAt: true,
        createdAt: true,
        identities: {
          where: { provider: "TELEGRAM" },
          select: { providerUserId: true, profile: true },
        },
      },
    });
  },

  touchLastLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  },

  createWithIdentity(input: {
    supabaseUserId: string;
    displayName: string;
    avatarUrl?: string | null;
    role?: UserRole;
    provider: AuthProvider;
    providerUserId: string;
    profile?: Prisma.InputJsonValue;
  }) {
    return prisma.user.create({
      data: {
        supabaseUserId: input.supabaseUserId,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl ?? null,
        role: input.role ?? "DJ",
        lastLoginAt: new Date(),
        identities: {
          create: {
            provider: input.provider,
            providerUserId: input.providerUserId,
            profile: input.profile,
          },
        },
      },
    });
  },

  updateProfileSnapshot(input: {
    userId: string;
    provider: AuthProvider;
    providerUserId: string;
    displayName: string;
    avatarUrl?: string | null;
    profile?: Prisma.InputJsonValue;
  }) {
    return prisma.$transaction([
      prisma.user.update({
        where: { id: input.userId },
        data: {
          displayName: input.displayName,
          avatarUrl: input.avatarUrl ?? null,
        },
      }),
      prisma.authIdentity.updateMany({
        where: {
          provider: input.provider,
          providerUserId: input.providerUserId,
        },
        data: { profile: input.profile },
      }),
    ]);
  },
};
