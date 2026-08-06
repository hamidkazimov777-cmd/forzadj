import { prisma } from "./prisma";
import type { Prisma, TrackSubmission } from "@/generated/prisma/client";
import type { SubmissionStatus, SubmissionWorkType } from "@/generated/prisma/enums";

/** JSON-коэрция к типу Prisma (совместимо с InputJsonValue). */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Доступ к данным пользовательских заявок на публикацию. Soft delete
 * (глобальный фильтр в prisma.ts). Смена статуса — только по решению модератора
 * (Publish/Reject в боте модерации), см. submission.actions / moderate route.
 */
export const submissionRepository = {
  create(input: {
    userId: string;
    title: string;
    artist: string;
    versionLabel?: string | null;
    workType: SubmissionWorkType;
    genre?: string | null;
    bpm?: number | null;
    musicalKey?: string | null;
    description?: string | null;
    author?: string | null;
    contacts?: string | null;
    socials?: unknown;
    audioKey: string;
    audioMime: string;
    audioSizeBytes: number | bigint;
  }) {
    return prisma.trackSubmission.create({
      data: {
        userId: input.userId,
        title: input.title,
        artist: input.artist,
        versionLabel: input.versionLabel ?? null,
        workType: input.workType,
        genre: input.genre ?? null,
        bpm: input.bpm ?? null,
        musicalKey: input.musicalKey ?? null,
        description: input.description ?? null,
        author: input.author ?? null,
        contacts: input.contacts ?? null,
        socials: toJson(input.socials),
        audioKey: input.audioKey,
        audioMime: input.audioMime,
        audioSizeBytes: BigInt(input.audioSizeBytes),
        status: "ON_MODERATION",
      },
    });
  },

  findById(id: string) {
    return prisma.trackSubmission.findUnique({ where: { id } });
  },

  /** История заявок пользователя для ЛК. */
  listForUser(
    userId: string,
    opts?: { skip?: number; take?: number },
  ): Promise<TrackSubmission[]> {
    return prisma.trackSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: opts?.skip ?? 0,
      take: opts?.take ?? 50,
    });
  },

  /** Отметить результат модерации (Publish/Reject). */
  setDecision(
    id: string,
    input: {
      status: Extract<SubmissionStatus, "PUBLISHED" | "REJECTED">;
      rejectReason?: string | null;
      moderatorNote?: string | null;
      publishedTrackId?: string | null;
      reviewedById?: string | null;
    },
  ) {
    return prisma.trackSubmission.update({
      where: { id },
      data: {
        status: input.status,
        rejectReason: input.rejectReason ?? null,
        moderatorNote: input.moderatorNote ?? null,
        publishedTrackId: input.publishedTrackId ?? null,
        reviewedById: input.reviewedById ?? null,
        reviewedAt: new Date(),
      },
    });
  },
};
