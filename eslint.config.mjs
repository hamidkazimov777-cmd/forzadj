import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ─── Границы слоёв (архитектура v2) ────────────────────────────────────────
// 1. Vendor SDK — только внутри адаптеров своих портов.
// 2. Prisma — только внутри server/repositories.
// 3. Клиентские слои (components, hooks) не импортируют server/ —
//    данные приходят через props из Server Components / Actions.

const vendorSupabase = {
  group: ["@supabase/*"],
  message:
    "Импорт Supabase SDK разрешён только в адаптерах: server/storage/adapters/ или server/auth/providers/.",
};

const vendorPrisma = {
  group: ["@prisma/*", "@/generated/prisma*", "**/generated/prisma*", "pg"],
  message:
    "Прямой доступ к Prisma/БД разрешён только в server/repositories/.",
};

const serverFromClient = {
  group: ["@/server/*"],
  message:
    "Клиентские слои (components/, hooks/) не импортируют server/ — передавайте данные через props из Server Components или вызывайте Server Actions.",
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/generated/**",
    ],
  },
  // Базовый запрет vendor SDK и Prisma везде…
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [vendorSupabase, vendorPrisma] },
      ],
    },
  },
  // …кроме адаптеров storage и auth-провайдеров (Supabase разрешён)
  {
    files: [
      "src/server/storage/adapters/**/*.ts",
      "src/server/auth/providers/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [vendorPrisma] }],
    },
  },
  // …и кроме repositories (Prisma разрешён)
  {
    files: ["src/server/repositories/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [vendorSupabase] }],
    },
  },
  // Клиентские слои не тянут server/
  {
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [vendorSupabase, vendorPrisma, serverFromClient] },
      ],
    },
  },
];

export default eslintConfig;
