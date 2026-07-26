import type { DonationProvider } from "@/types/db";

/**
 * Порт платёжного провайдера донатов (provider-agnostic).
 *
 * На этапе MVP реализаций НЕТ — определён только контракт. Любой провайдер
 * (Telegram Stars, ЮKassa, Stripe, Boosty, Patreon, крипто) в будущем
 * реализует этот интерфейс и регистрируется в registry, не затрагивая
 * DonationService и остальную бизнес-логику.
 *
 * Здесь НЕТ платёжной логики, ссылок, вебхуков и SDK — только сигнатуры.
 */

/** Данные для инициации платежа у провайдера. */
export interface InitiatePaymentInput {
  donationId: string;
  amountMinor: number;
  currency: string;
  /** Абсолютный URL возврата после оплаты (если провайдер требует). */
  returnUrl?: string;
}

/** Результат инициации: ссылка/идентификатор для завершения оплаты. */
export interface InitiatePaymentResult {
  externalPaymentId: string;
  /** URL страницы оплаты провайдера (redirect/checkout), если применимо. */
  checkoutUrl?: string;
  /** Провайдеро-специфичные данные для сохранения в Donation.metadata. */
  metadata?: Record<string, unknown>;
}

/** Нормализованный результат разбора вебхука провайдера. */
export interface ParsedWebhook {
  externalPaymentId: string;
  /** Итоговый статус платежа в терминах провайдера, отображённый на наш. */
  status: "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED" | "PENDING";
  /** Сырые данные события — для журнала DonationEvent. */
  raw: Record<string, unknown>;
}

export interface DonationProviderAdapter {
  readonly provider: DonationProvider;

  /** Создать платёж у провайдера. Реализуется в будущем. */
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;

  /**
   * Проверить подпись вебхука и разобрать его в нормализованный вид.
   * `signature` — заголовок/токен провайдера для верификации подлинности.
   */
  verifyAndParseWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<ParsedWebhook | null>;
}
