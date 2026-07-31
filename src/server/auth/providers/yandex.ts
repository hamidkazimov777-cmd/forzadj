/**
 * Яндекс ID (OAuth 2.0, authorization code flow).
 *
 * Поток: /api/auth/yandex → authorize (Яндекс) → callback с ?code →
 * обмен кода на токен → запрос профиля → выпуск сессии.
 *
 * Запрашиваем минимум данных (login:info): стабильный id, отображаемое имя,
 * аватар. Телефон/почта/паспорт НЕ запрашиваются (минимизация ПД).
 */

const AUTHORIZE_URL = "https://oauth.yandex.ru/authorize";
const TOKEN_URL = "https://oauth.yandex.ru/token";
const INFO_URL = "https://login.yandex.ru/info";

export function yandexConfigured(): boolean {
  return Boolean(
    process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET,
  );
}

function clientId(): string {
  const v = process.env.YANDEX_CLIENT_ID;
  if (!v) throw new Error("YANDEX_CLIENT_ID is not set");
  return v;
}

function clientSecret(): string {
  const v = process.env.YANDEX_CLIENT_SECRET;
  if (!v) throw new Error("YANDEX_CLIENT_SECRET is not set");
  return v;
}

/** Адрес возврата (должен совпадать с Redirect URI в кабинете Яндекса). */
export function yandexRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL("/api/auth/yandex/callback", base).toString();
}

/** URL для перенаправления пользователя на страницу согласия Яндекса. */
export function buildYandexAuthUrl(state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", yandexRedirectUri());
  url.searchParams.set("state", state);
  // scope НЕ передаём: используются доступы, включённые в кабинете приложения
  // (это избавляет от рассинхрона invalid_scope). Нужный минимум — логин/имя/
  // аватар — настраивается галочками в самом приложении Яндекса.
  return url.toString();
}

/** Обмен authorization code на access token. */
export async function exchangeYandexCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: yandexRedirectUri(),
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`yandex token exchange failed: ${res.status}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("yandex token: no access_token");
  return data.access_token;
}

export interface YandexProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  login: string | null;
}

/** Профиль пользователя по access token. */
export async function fetchYandexProfile(
  accessToken: string,
): Promise<YandexProfile> {
  const url = new URL(INFO_URL);
  url.searchParams.set("format", "json");
  const res = await fetch(url, {
    headers: { Authorization: `OAuth ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`yandex profile failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    id: string;
    login?: string;
    display_name?: string;
    real_name?: string;
    first_name?: string;
    default_avatar_id?: string;
    is_avatar_empty?: boolean;
  };

  const displayName =
    data.display_name ||
    data.real_name ||
    data.first_name ||
    data.login ||
    `DJ ${data.id}`;

  const avatarUrl =
    data.default_avatar_id && !data.is_avatar_empty
      ? `https://avatars.yandex.net/get-yapic/${data.default_avatar_id}/islands-200`
      : null;

  return {
    id: String(data.id),
    displayName,
    avatarUrl,
    login: data.login ?? null,
  };
}
