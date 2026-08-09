import { prisma } from "./prisma";
import type { AssetStatus, AssetType } from "@/generated/prisma/enums";

export const assetRepository = {
  findById(id: string) {
    return prisma.asset.findFirst({
      where: { id },
      include: { version: { include: { track: true } } },
    });
  },

  create(input: {
    versionId?: string;
    releaseId?: string;
    type: AssetType;
    storageKey: string;
    originalName?: string;
    mime?: string;
    sizeBytes?: bigint;
    createdById?: string;
  }) {
    return prisma.asset.create({ data: input });
  },

  update(id: string, data: Partial<{ storageKey: string; originalName: string | null; mime: string; sizeBytes: bigint }>) {
    return prisma.asset.update({ where: { id }, data });
  },

  setStatus(
    id: string,
    status: AssetStatus,
    extra?: {
      error?: string | null;
      checksumSha256?: string;
      sizeBytes?: bigint;
      mime?: string;
    },
  ) {
    return prisma.asset.update({
      where: { id },
      data: { status, ...extra },
    });
  },

  /** Заменяемый ассет (превью/waveform при повторной обработке). */
  async softDeleteByVersionAndType(versionId: string, type: AssetType) {
    await prisma.asset.updateMany({
      where: { versionId, type, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  },

  /** READY-ассет версии заданного типа (для отдачи обложки/waveform). */
  findReadyByVersionAndType(versionId: string, type: AssetType) {
    return prisma.asset.findFirst({
      where: { versionId, type, status: "READY", deletedAt: null },
    });
  },
};
