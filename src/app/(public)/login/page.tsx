import { redirect } from "next/navigation";

/**
 * Вход переехал на главную. Оставляем тонкий редирект, чтобы старые
 * ссылки/закладки /login и прежние редиректы не давали 404. Сохраняем error/next.
 */
export default async function LoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const params = new URLSearchParams();
  if (error) params.set("error", error);
  if (next) params.set("next", next);
  const qs = params.toString();
  redirect(qs ? `/?${qs}` : "/");
}
