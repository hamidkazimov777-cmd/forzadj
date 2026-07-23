import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma-клиент — единственная точка доступа к БД.
 * Импортируется ТОЛЬКО из server/repositories/* (закреплено ESLint-правилом).
 *
 * Экспортируются два клиента:
 * - `prisma`     — с глобальным soft-delete-фильтром (deleted_at IS NULL);
 *                  использовать по умолчанию.
 * - `prismaBase` — без фильтра; только для корзины/восстановления
 *                  и физической очистки (purge-job).
 */

// Модели, участвующие в soft delete. Модель добавляется сюда
// одновременно с полем deletedAt в схеме.
const SOFT_DELETE_MODELS = new Set<string>(["User"]);

function createBaseClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  });
  return new PrismaClient({ adapter });
}

function createSoftDeleteClient(base: ReturnType<typeof createBaseClient>) {
  return base.$extends({
    name: "softDelete",
    query: {
      $allModels: {
        // Чтения: добавляем deletedAt: null, если фильтр не задан явно.
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { deletedAt: null, ...args.where };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { deletedAt: null, ...args.where };
          }
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { deletedAt: null, ...args.where };
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { deletedAt: null, ...args.where };
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { deletedAt: null, ...args.where };
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { deletedAt: null, ...args.where };
          }
          return query(args);
        },
        // Мутации по фильтру не должны задевать удалённые записи.
        async updateMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            args.where = { deletedAt: null, ...args.where };
          }
          return query(args);
        },
        // Удаление превращается в soft delete.
        async delete({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            const client = prismaBase as unknown as Record<
              string,
              { update: (a: unknown) => Promise<unknown> }
            >;
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            return client[modelKey].update({
              where: args.where,
              data: { deletedAt: new Date() },
            });
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            const client = prismaBase as unknown as Record<
              string,
              { updateMany: (a: unknown) => Promise<unknown> }
            >;
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            return client[modelKey].updateMany({
              where: { deletedAt: null, ...args.where },
              data: { deletedAt: new Date() },
            });
          }
          return query(args);
        },
      },
    },
  });
}

// Синглтоны, переживающие HMR в dev.
const globalForPrisma = globalThis as unknown as {
  prismaBase?: ReturnType<typeof createBaseClient>;
  prisma?: ReturnType<typeof createSoftDeleteClient>;
};

export const prismaBase = globalForPrisma.prismaBase ?? createBaseClient();
export const prisma =
  globalForPrisma.prisma ?? createSoftDeleteClient(prismaBase);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = prismaBase;
  globalForPrisma.prisma = prisma;
}
