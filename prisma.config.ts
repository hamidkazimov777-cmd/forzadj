import "dotenv/config";
import { defineConfig } from "prisma/config";

// CLI (migrate/studio) ходит в БД напрямую (DIRECT_URL — без пулера);
// runtime-подключение приложения настраивается адаптером в PrismaClient
// (src/server/repositories/prisma.ts) через DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
