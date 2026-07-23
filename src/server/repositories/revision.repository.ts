import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  RevisionAction,
  RevisionEntity,
} from "@/generated/prisma/enums";

export const revisionRepository = {
  /** Запись ревизии. snapshot — состояние ДО изменения (null для CREATE). */
  record(input: {
    entityType: RevisionEntity;
    entityId: string;
    action: RevisionAction;
    snapshot?: unknown;
    changedFields?: string[];
    actorId?: string | null;
  }) {
    return prisma.revision.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        snapshot:
          input.snapshot === undefined
            ? undefined
            : (JSON.parse(JSON.stringify(input.snapshot)) as Prisma.InputJsonValue),
        changedFields: input.changedFields ?? [],
        actorId: input.actorId ?? null,
      },
    });
  },

  listForEntity(entityType: RevisionEntity, entityId: string, limit = 50) {
    return prisma.revision.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
