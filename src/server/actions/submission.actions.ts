"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/core/session";
import { submissionRepository } from "@/server/repositories/submission.repository";
import { revisionRepository } from "@/server/repositories/revision.repository";
import { getStorage } from "@/server/storage";
import {
  SUBMISSION_WORK_TYPE_VALUES,
  SUBMISSION_AUDIO_MAX_BYTES,
  SUBMISSION_AUDIO_MIME,
} from "@/lib/config/submission";
import type { SubmissionResult } from "@/types/submission";

/**
 * Заявка пользователя на публикацию собственного трека. MP3 кладётся в приватный
 * бакет "submissions", метаданные — в TrackSubmission (status ON_MODERATION),
 * затем заявка отправляется в бот модерации (HTTP-ingest на VPS). Модератор
 * решает Publish/Reject — статус у пользователя меняется по колбэку модератора.
 *
 * Безопасность: userId только из сессии; поля — zod; MP3 проверяется по типу/
 * размеру; согласие обязательно.
 */

const schema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(200),
  artist: z.string().trim().min(1, "Укажите артиста").max(200),
  versionLabel: z.string().trim().max(120).optional(),
  workType: z.enum(SUBMISSION_WORK_TYPE_VALUES),
  genre: z.string().trim().max(80).optional(),
  bpm: z.coerce.number().int().min(40).max(300).optional(),
  key: z.string().trim().max(16).optional(),
  description: z.string().trim().max(2000).optional(),
  author: z.string().trim().max(200).optional(),
  contacts: z.string().trim().max(500).optional(),
  socials: z.string().trim().max(1000).optional(),
  agreeTerms: z.literal("on", { message: "Необходимо принять соглашение" }),
  agreeExclusive: z.literal("on", { message: "Необходимо принять условие эксклюзивности" }),
});

export async function submitTrackAction(
  formData: FormData,
): Promise<SubmissionResult> {
  const user = await requireUser();

  const parsed = schema.safeParse({
    title: (formData.get("title") as string) || undefined,
    artist: (formData.get("artist") as string) || undefined,
    versionLabel: (formData.get("versionLabel") as string) || undefined,
    workType: formData.get("workType"),
    genre: (formData.get("genre") as string) || undefined,
    bpm: (formData.get("bpm") as string) || undefined,
    key: (formData.get("key") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    author: (formData.get("author") as string) || undefined,
    contacts: (formData.get("contacts") as string) || undefined,
    socials: (formData.get("socials") as string) || undefined,
    agreeTerms: formData.get("agreeTerms"),
    agreeExclusive: formData.get("agreeExclusive"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }

  // Аудио: только MP3.
  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Прикрепите MP3-файл" };
  }
  if (!SUBMISSION_AUDIO_MIME.has(file.type)) {
    return { ok: false, error: "Только MP3" };
  }
  if (file.size > SUBMISSION_AUDIO_MAX_BYTES) {
    return { ok: false, error: "Файл больше 100 МБ" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const audioKey = `submissions/${user.id}/${randomUUID()}.mp3`;
  await getStorage().put("submissions", audioKey, bytes, {
    contentType: file.type,
  });

  const socials = (parsed.data.socials ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const submission = await submissionRepository.create({
    userId: user.id,
    title: parsed.data.title,
    artist: parsed.data.artist,
    versionLabel: parsed.data.versionLabel,
    workType: parsed.data.workType,
    genre: parsed.data.genre,
    bpm: parsed.data.bpm,
    musicalKey: parsed.data.key,
    description: parsed.data.description,
    author: parsed.data.author,
    contacts: parsed.data.contacts,
    socials,
    audioKey,
    audioMime: file.type,
    audioSizeBytes: file.size,
  });

  await revisionRepository.record({
    entityType: "TRACK",
    entityId: submission.id,
    action: "CREATE",
    actorId: null,
  });

  // Доставка в бот модерации (best-effort — заявка уже сохранена).
  await deliverToModerationBot(submission.id, parsed.data, socials, {
    userId: user.id,
    name: user.displayName,
    fileName: file.name,
    mimeType: file.type,
    bytes,
  });

  revalidatePath("/account");
  return { ok: true, submissionId: submission.id };
}

async function deliverToModerationBot(
  submissionId: string,
  data: z.infer<typeof schema>,
  socials: string[],
  audio: {
    userId: string;
    name: string;
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
  },
): Promise<void> {
  const url = process.env.MODERATION_INGEST_URL;
  const secret = process.env.MODERATION_INGEST_SECRET;
  if (!url || !secret) {
    console.warn("[submission] moderation ingest not configured — skipped delivery");
    return;
  }
  try {
    const res = await fetch(url.replace(/\/$/, "") + "/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-secret": secret },
      body: JSON.stringify({
        submissionId,
        audioBase64: Buffer.from(audio.bytes).toString("base64"),
        fileName: audio.fileName,
        mimeType: audio.mimeType,
        title: data.title,
        artist: data.artist,
        version: data.versionLabel || data.workType,
        genre: data.genre,
        bpm: data.bpm,
        key: data.key,
        description: data.description,
        author: data.author,
        contacts: data.contacts,
        socials,
        submitter: { userId: audio.userId, name: audio.name },
      }),
    });
    if (!res.ok) {
      console.error(`[submission] ingest failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[submission] ingest error:", err);
  }
}
