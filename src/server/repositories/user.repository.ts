import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthProvider } from "@/generated/prisma/enums";

export const userRepository = {
  setRole(userId: string, role: "DJ" | "UPLOADER" | "ADMIN") {
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

  createWithIdentity(input: {
    supabaseUserId: string;
    displayName: string;
    avatarUrl?: string | null;
    provider: AuthProvider;
    providerUserId: string;
    profile?: Prisma.InputJsonValue;
  }) {
    return prisma.user.create({
      data: {
        supabaseUserId: input.supabaseUserId,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl ?? null,
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
