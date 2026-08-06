/** Результат отправки обращения в поддержку (форма Support). */
export interface SupportTicketResult {
  ok: boolean;
  error?: string;
  ticketId?: string;
}

export type SupportTicketSubmitFn = (
  formData: FormData,
) => Promise<SupportTicketResult>;
