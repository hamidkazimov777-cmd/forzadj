/**
 * Банковские реквизиты для поддержки проекта. Значения читаются из
 * переменных окружения (NEXT_PUBLIC_*), а не хранятся в исходном коде —
 * это личные банковские данные владельца, им не место в публичном git.
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

function env(name: string): string {
  return process.env[name] ?? "";
}

/** Убирает всё, кроме цифр и ведущего "+" — для копируемых значений карт/телефонов. */
function digitsOnly(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export const donationThankYou = {
  title: "Спасибо за поддержку проекта ❤️",
  text: "Каждый донат помогает оплачивать серверы, покупать эксклюзивную музыку, развивать каталог и выпускать новые функции.",
} as const;

export const domesticMethod: DomesticMethod = {
  region: "RU",
  flag: "🇷🇺",
  title: "Россия",
  bank: env("NEXT_PUBLIC_DONATE_RU_BANK"),
  card: {
    number: env("NEXT_PUBLIC_DONATE_RU_CARD"),
    copyValue: digitsOnly(env("NEXT_PUBLIC_DONATE_RU_CARD")),
  },
  sbp: {
    phone: env("NEXT_PUBLIC_DONATE_RU_SBP_PHONE"),
    copyValue: digitsOnly(env("NEXT_PUBLIC_DONATE_RU_SBP_PHONE")),
  },
};

export const internationalMethod: InternationalMethod = {
  region: "INTL",
  flag: "🌍",
  title: "Международный перевод",
  bank: env("NEXT_PUBLIC_DONATE_INTL_BANK"),
  system: "Visa",
  card: {
    number: env("NEXT_PUBLIC_DONATE_INTL_CARD"),
    copyValue: digitsOnly(env("NEXT_PUBLIC_DONATE_INTL_CARD")),
  },
  swift: [
    { label: "Получатель", value: env("NEXT_PUBLIC_DONATE_SWIFT_RECIPIENT") },
    { label: "Банк", value: env("NEXT_PUBLIC_DONATE_SWIFT_BANK") },
    { label: "Код филиала", value: env("NEXT_PUBLIC_DONATE_SWIFT_BRANCH") },
    { label: "Валюта", value: env("NEXT_PUBLIC_DONATE_SWIFT_CURRENCY") },
    { label: "ИНН", value: env("NEXT_PUBLIC_DONATE_SWIFT_INN") },
    { label: "SWIFT", value: env("NEXT_PUBLIC_DONATE_SWIFT_CODE") },
    {
      label: "IBAN",
      value: env("NEXT_PUBLIC_DONATE_SWIFT_IBAN"),
      copyValue: env("NEXT_PUBLIC_DONATE_SWIFT_IBAN"),
    },
    { label: "Банк-корреспондент", value: env("NEXT_PUBLIC_DONATE_SWIFT_CORR_BANK") },
    { label: "SWIFT корреспондента", value: env("NEXT_PUBLIC_DONATE_SWIFT_CORR_CODE") },
    { label: "Счёт банка-корреспондента", value: env("NEXT_PUBLIC_DONATE_SWIFT_CORR_ACCOUNT") },
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
