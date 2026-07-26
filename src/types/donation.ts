/** Результат отправки заявки о поддержке. */
export interface SupportSubmitResult {
  ok: boolean;
  error?: string;
}

export type SupportSubmitFn = (formData: FormData) => Promise<SupportSubmitResult>;

/** Строка заявки для Studio. */
export interface SupportRequestRow {
  id: string;
  donorName: string | null;
  userDisplayName: string;
  amountMinor: number;
  currency: string;
  comment: string | null;
  hasReceipt: boolean;
  status: string;
  createdAt: string; // ISO
}
