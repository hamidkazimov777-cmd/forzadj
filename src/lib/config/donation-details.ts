/**
 * Банковские реквизиты для поддержки проекта. Централизованно — не внутри
 * компонентов. Меняются здесь; UI и Studio берут отсюда.
 *
 * Это ручные переводы (без платёжных провайдеров): пользователь переводит
 * сам и оставляет заявку, владелец сверяет вручную.
 */

export interface CopyableField {
  label: string;
  value: string;
  /** Значение для копирования (без пробелов/форматирования), если отличается. */
  copyValue?: string;
}

export interface DomesticMethod {
  region: "RU";
  flag: string;
  title: string;
  bank: string;
  card: { number: string; copyValue: string };
  sbp: { phone: string; copyValue: string };
}

export interface InternationalMethod {
  region: "INTL";
  flag: string;
  title: string;
  bank: string;
  system: string;
  card: { number: string; copyValue: string };
  swift: CopyableField[];
}

export const donationThankYou = {
  title: "Спасибо за поддержку проекта ❤️",
  text: "Каждый донат помогает оплачивать серверы, покупать эксклюзивную музыку, развивать каталог и выпускать новые функции.",
} as const;

export const domesticMethod: DomesticMethod = {
  region: "RU",
  flag: "🇷🇺",
  title: "Россия",
  bank: "Сбербанк",
  card: { number: "2202 2085 8278 7686", copyValue: "2202208582787686" },
  sbp: { phone: "+7 930 226 80 36", copyValue: "+79302268036" },
};

export const internationalMethod: InternationalMethod = {
  region: "INTL",
  flag: "🌍",
  title: "Международный перевод",
  bank: "Kapital Bank",
  system: "Visa",
  card: { number: "4169 7388 0286 9234", copyValue: "4169738802869234" },
  swift: [
    { label: "Получатель", value: "KAZIMOV HƏMİD ELÇİN OĞLU" },
    { label: "Банк", value: "KapitalBank ASC\n7 s Baki Asan f" },
    { label: "Код филиала", value: "201489" },
    { label: "Валюта", value: "USD" },
    { label: "ИНН", value: "9900003611" },
    { label: "SWIFT", value: "AIIBAZ2X" },
    { label: "IBAN", value: "AZ34AIIB38817840000142531100", copyValue: "AZ34AIIB38817840000142531100" },
    { label: "Банк-корреспондент", value: "Bank of New York Mellon" },
    { label: "SWIFT корреспондента", value: "IRVTUS3N" },
    { label: "Счёт банка-корреспондента", value: "8901723762" },
  ],
};

/** Полный текст SWIFT-реквизитов для кнопки «Скопировать все реквизиты». */
export function fullSwiftText(): string {
  return internationalMethod.swift
    .map((f) => `${f.label}: ${f.value.replace(/\n/g, " ")}`)
    .join("\n");
}

/** Валюты, доступные при подтверждении перевода. */
export const donationCurrencies = ["RUB", "USD"] as const;
export type DonationCurrency = (typeof donationCurrencies)[number];
