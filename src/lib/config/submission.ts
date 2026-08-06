import type { SubmissionStatus, SubmissionWorkType } from "@/types/db";

/** Типы пользовательской работы (совпадают с enum SubmissionWorkType). */
export const SUBMISSION_WORK_TYPES: { value: SubmissionWorkType; label: string }[] = [
  { value: "REMIX", label: "Remix" },
  { value: "EDIT", label: "Edit" },
  { value: "MASHUP", label: "Mashup" },
  { value: "BLEND", label: "Blend" },
  { value: "BOOTLEG", label: "Bootleg" },
  { value: "REWORK", label: "Rework" },
  { value: "VIP", label: "VIP" },
  { value: "TRANSITION", label: "Transition" },
];

export const SUBMISSION_WORK_TYPE_VALUES = SUBMISSION_WORK_TYPES.map(
  (t) => t.value,
) as [SubmissionWorkType, ...SubmissionWorkType[]];

/** Статусы заявки для отображения в ЛК. */
export const SUBMISSION_STATUS_LABELS: Record<
  SubmissionStatus,
  { label: string; tone: "pending" | "success" | "danger" }
> = {
  ON_MODERATION: { label: "На модерации", tone: "pending" },
  PUBLISHED: { label: "Опубликован", tone: "success" },
  REJECTED: { label: "Отклонён", tone: "danger" },
};

/** Аудио заявки: только MP3. */
export const SUBMISSION_AUDIO_MAX_BYTES = 100 * 1024 * 1024; // 100 МБ
export const SUBMISSION_AUDIO_MIME = new Set<string>([
  "audio/mpeg",
  "audio/mp3",
]);
export const SUBMISSION_AUDIO_ACCEPT = ".mp3,audio/mpeg";
