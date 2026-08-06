import type { SupportCategory } from "@/types/db";

/**
 * Категории обращений формы Support. Значения совпадают с enum SupportCategory
 * в schema.prisma; порядок задаёт порядок в выпадающем списке.
 */
export const SUPPORT_CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: "GENERAL", label: "Общий вопрос" },
  { value: "ACCOUNT", label: "Проблема с аккаунтом" },
  { value: "SUBSCRIPTION", label: "Проблема с подпиской" },
  { value: "SITE_BUG", label: "Ошибка сайта" },
  { value: "UPLOAD_ISSUE", label: "Проблема с загрузкой" },
  { value: "SUGGESTION", label: "Предложение" },
  { value: "COMPLAINT", label: "Жалоба" },
  { value: "VIOLATION", label: "Нарушение" },
  { value: "COPYRIGHT", label: "Правообладатель" },
  { value: "OTHER", label: "Другое" },
];

export const SUPPORT_CATEGORY_VALUES = SUPPORT_CATEGORIES.map((c) => c.value) as [
  SupportCategory,
  ...SupportCategory[],
];

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> =
  Object.fromEntries(
    SUPPORT_CATEGORIES.map((c) => [c.value, c.label]),
  ) as Record<SupportCategory, string>;

/** Лимиты вложений. */
export const SUPPORT_ATTACHMENT_MAX_FILES = 5;
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 МБ на файл
export const SUPPORT_ATTACHMENT_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/zip",
]);
