import https from "node:https";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { aiConfig } from "@/lib/config/ai";

/**
 * Клиент GigaChat (Sber). Два эндпоинта:
 *  - OAuth: обмен Authorization Key на access_token (~30 мин жизни).
 *  - Chat Completions: собственно генерация.
 *
 * Почему node:https, а не fetch: GigaChat отдаётся за российским TLS
 * («Russian Trusted Root CA»). undici-fetch в Next.js не даёт удобно
 * подсунуть CA/agent на конкретный запрос, а https.Agent — даёт. В проде
 * CA подключается глобально через NODE_EXTRA_CA_CERTS; agent здесь нужен
 * лишь для опционального insecure-fallback при локальной отладке.
 *
 * Только Node runtime (не Edge) — как и весь аудио-слой.
 */

const OAUTH_HOST = "ngw.devices.sberbank.ru";
const OAUTH_PATH = "/api/v2/oauth";
const API_HOST = "gigachat.devices.sberbank.ru";
const CHAT_PATH = "/api/v1/chat/completions";

// Кэш токена в памяти процесса. Обновляем заранее (за 60 с до истечения).
let tokenCache: { token: string; expiresAt: number } | null = null;

// Российский CA читаем один раз (файл может отсутствовать — тогда полагаемся
// на системный trust store / NODE_EXTRA_CA_CERTS).
let caCache: Buffer | null | undefined;
function loadCa(): Buffer | null {
  if (caCache !== undefined) return caCache;
  const path = aiConfig.caCertPath;
  try {
    caCache = path ? readFileSync(path) : null;
  } catch {
    caCache = null;
  }
  return caCache;
}

/** insecure-agent только когда явно разрешено флагом (локальная отладка). */
function agentFor(host: string): https.Agent {
  const ca = loadCa();
  return new https.Agent({
    host,
    rejectUnauthorized: !aiConfig.allowInsecureTls,
    ...(ca ? { ca } : {}),
    keepAlive: true,
  });
}

interface HttpResult {
  status: number;
  body: string;
}

function request(
  opts: https.RequestOptions,
  body: string | null,
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
        }),
      );
    });
    req.on("error", reject);
    // Жёсткий таймаут: ИИ не должен подвешивать серверный рендер/роут.
    req.setTimeout(20_000, () => req.destroy(new Error("GigaChat timeout")));
    if (body) req.write(body);
    req.end();
  });
}

async function fetchToken(): Promise<string> {
  const authKey = aiConfig.authKey;
  if (!authKey) throw new Error("GIGACHAT_AUTH_KEY не задан");

  const form = new URLSearchParams({ scope: aiConfig.scope }).toString();
  const res = await request(
    {
      host: OAUTH_HOST,
      path: OAUTH_PATH,
      method: "POST",
      agent: agentFor(OAUTH_HOST),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        RqUID: randomUUID(),
        Authorization: `Basic ${authKey}`,
        "Content-Length": Buffer.byteLength(form),
      },
    },
    form,
  );

  if (res.status !== 200) {
    throw new Error(`GigaChat OAuth ${res.status}: ${res.body.slice(0, 300)}`);
  }
  const data = JSON.parse(res.body) as {
    access_token?: string;
    expires_at?: number;
  };
  if (!data.access_token) throw new Error("GigaChat OAuth: нет access_token");

  // expires_at приходит в мс (unix). Fallback — 25 минут от текущего момента.
  const expiresAt = data.expires_at ?? Date.now() + 25 * 60 * 1000;
  tokenCache = { token: data.access_token, expiresAt };
  return data.access_token;
}

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt - 60_000 > Date.now()) {
    return tokenCache.token;
  }
  return fetchToken();
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Вызов chat/completions. Возвращает текст ответа ассистента.
 * При 401 (протух токен) — один повтор с принудительным обновлением.
 */
export async function gigachatComplete(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const payload = JSON.stringify({
    model: aiConfig.model,
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 1200,
    stream: false,
  });

  const send = async (token: string): Promise<HttpResult> =>
    request(
      {
        host: API_HOST,
        path: CHAT_PATH,
        method: "POST",
        agent: agentFor(API_HOST),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload,
    );

  let res = await send(await getToken());
  if (res.status === 401) {
    tokenCache = null;
    res = await send(await getToken());
  }
  if (res.status !== 200) {
    throw new Error(`GigaChat chat ${res.status}: ${res.body.slice(0, 300)}`);
  }

  const data = JSON.parse(res.body) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("GigaChat: пустой ответ");
  return content;
}
