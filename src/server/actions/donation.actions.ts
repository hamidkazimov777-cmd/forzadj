"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser, requireStudioPermission } from "@/server/auth/core/session";
import { donationService } from "@/server/services/donation.service";
import { donationRepository } from "@/server/repositories/donation.repository";
import { revisionRepository } from "@/server/repositories/revision.repository";
import { getStorage } from "@/server/storage";
import { donationCurrencies } from "@/lib/config/donation-details";
import type { SupportSubmitResult } from "@/types/donation";

/**
 * Заявки о ручной поддержке проекта. Никаких платёжных интеграций —
 * только журнал: пользователь переводит сам и оставляет заявку, владелец
 * сверяет вручную.
 *
 * Безопасность: userId только из сессии; сумма/валюта — zod; чек проходит
 * проверку типа/размера и кладётся в приватный бакет; статусами управляет
 * только SUPER_ADMIN.
 */

const RECEIPT_MAX_BYTES = 8 * 1024 * 1024; // 8 МБ
const RECEIPT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

const submitSchema = z.object({
  donorName: z.string().trim().max(80).optional(),
  amount: z.coerce.number().positive().max(10_000_000),
  currency: z.enum(donationCurrencies),
  comment: z.string().trim().max(500).optional(),
});

export async function submitSupportRequestAction(
  formData: FormData,
): Promise<SupportSubmitResult> {
  const user = await requireUser();

  const parsed = submitSchema.safeParse({
    donorName: (formData.get("donorName") as string) || undefined,
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    comment: (formData.get("comment") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }

  // Чек (необязательно): валидируем и кладём в приватный бакет.
  let receiptKey: string | undefined;
  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0) {
    if (!RECEIPT_MIME.has(file.type)) {
      return { ok: false, error: "Чек: только изображение или PDF" };
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      return { ok: false, error: "Чек больше 8 МБ" };
    }
    const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "bin";
    receiptKey = `receipts/${user.id}/${randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await getStorage().put("receipts", receiptKey, bytes, {
      contentType: file.type,
    });
  }

  const amountMinor = Math.round(parsed.data.amount * 100);
  await donationService.createManualDonation(user.id, {
    amountMinor,
    currency: parsed.data.currency,
    donorName: parsed.data.donorName,
    comment: parsed.data.comment,
    receiptKey,
  });

  return { ok: true };
}

/** Подтверждение заявки владельцем → COMPLETED. Ручная сверка. */
export async function approveDonationAction(donationId: string): Promise<void> {
  const actor = await requireStudioPermission("donations.manage");
  await donationService.transitionStatus(donationId, "COMPLETED", {
    payload: { reviewedBy: actor.id, decision: "approved" },
  });
  await revisionRepository.record({
    entityType: "USER", // журналируем действие владельца
    entityId: donationId,
    action: "UPDATE",
    changedFields: ["donation.status:COMPLETED"],
    actorId: actor.id,
  });
  revalidatePath("/studio/support");
}

/** Отклонение заявки владельцем → CANCELLED. Не влияет на аккаунт. */
export async function rejectDonationAction(donationId: string): Promise<void> {
  const actor = await requireStudioPermission("donations.manage");
  await donationService.transitionStatus(donationId, "CANCELLED", {
    payload: { reviewedBy: actor.id, decision: "rejected" },
  });
  await revisionRepository.record({
    entityType: "USER",
    entityId: donationId,
    action: "UPDATE",
    changedFields: ["donation.status:CANCELLED"],
    actorId: actor.id,
  });
  revalidatePath("/studio/support");
}

/** Подписанная ссылка на чек (только владелец). TTL 5 минут. */
export async function getReceiptUrlAction(
  donationId: string,
): Promise<{ url: string } | { error: string }> {
  await requireStudioPermission("donations.manage");
  const donation = await donationRepository.findById(donationId);
  const meta = donation?.metadata as { receiptKey?: string } | null;
  if (!meta?.receiptKey) return { error: "Чек не приложен" };
  const signed = await getStorage().createSignedDownloadUrl(
    "receipts",
    meta.receiptKey,
    { expiresInSeconds: 300 },
  );
  return { url: signed.url };
}
