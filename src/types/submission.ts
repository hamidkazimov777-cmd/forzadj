/** Результат отправки заявки на публикацию своего трека. */
export interface SubmissionResult {
  ok: boolean;
  error?: string;
  submissionId?: string;
}

export type SubmissionSubmitFn = (
  formData: FormData,
) => Promise<SubmissionResult>;

/** Строка истории заявок для ЛК. */
export interface SubmissionRow {
  id: string;
  title: string;
  artist: string;
  workType: string;
  status: string;
  rejectReason: string | null;
  createdAt: string; // ISO
}
