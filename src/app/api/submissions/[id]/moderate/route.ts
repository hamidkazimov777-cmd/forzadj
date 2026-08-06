import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { submissionRepository } from "@/server/repositories/submission.repository";
import { userRepository } from "@/server/repositories/user.repository";
import { sendTelegramMessage, escapeHtml } from "@/server/notifications/telegram";

/**
 * Колбэк решения модерации от бота модерации (@forzadj_creator_bot).
 * Auth: заголовок x-bot-secret === MODERATION_API_SECRET.
 *
 * Меняет статус заявки (PUBLISHED/REJECTED) и уведомляет пользователя в Telegram
 * через login-бота (пользователь уже сделал /start у него при входе).
 */

const bodySchema = z.union([
  z.object({
    decision: z.literal("published"),
    trackId: z.string().min(1),
    slug: z.string().optional(),
  }),
  z.object({
    decision: z.literal("rejected"),
    reason: z.string().trim().min(1).max(1000),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const secret = process.env.MODERATION_API_SECRET;
  if (!secret || req.headers.get("x-bot-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const submission = await submissionRepository.findById(id);
  if (!submission) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://forzadj.ru";
  const data = parsed.data;

  if (data.decision === "published") {
    await submissionRepository.setDecision(id, {
      status: "PUBLISHED",
      publishedTrackId: data.trackId,
    });
    const link = data.slug ? `${appUrl}/pool/track/${data.slug}` : appUrl;
    await notifyUser(
      submission.userId,
      `✅ Ваш трек «${submission.title}» прошёл модерацию и опубликован в каталоге ForzaDJ.\n${link}`,
    );
  } else {
    await submissionRepository.setDecision(id, {
      status: "REJECTED",
      rejectReason: data.reason,
    });
    await notifyUser(
      submission.userId,
      `❌ Ваша заявка на публикацию трека «${submission.title}» отклонена.\nПричина: ${data.reason}`,
    );
  }

  revalidatePath("/account");
  return NextResponse.json({ ok: true });
}

async function notifyUser(userId: string, text: string): Promise<void> {
  const telegramId = await userRepository.getTelegramId(userId);
  await sendTelegramMessage(
    process.env.TELEGRAM_BOT_TOKEN,
    telegramId ?? undefined,
    escapeHtml(text),
  );
}
