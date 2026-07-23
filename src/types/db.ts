/**
 * Единственная санкционированная точка доступа к enum'ам Prisma вне
 * repositories (ESLint-исключение в eslint.config.mjs). Enum'ы — чистые
 * константы без доступа к БД; сам клиент остаётся закрытым.
 */
export * from "@/generated/prisma/enums";
