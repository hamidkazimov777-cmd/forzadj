-- Собственные сессии вместо Supabase Auth: supabase_user_id больше не обязателен.
ALTER TABLE "users" ALTER COLUMN "supabase_user_id" DROP NOT NULL;
