import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── .env ────────────────────────────────────────────────────────────────
function loadDotEnv() {
  const envPath = resolve(__dirname, "../.env");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore
  }
}
loadDotEnv();

const BOT_TOKEN = process.env.PACK_BOT_TOKEN;
const ADMIN_IDS = (process.env.PACK_BOT_ADMIN_IDS || "").split(",").map((s) => s.trim());
const BOT_SECRET = process.env.BOT_UPLOAD_SECRET;
const API_URL = process.env.PACK_BOT_API_URL || "http://127.0.0.1:3000";

if (!BOT_TOKEN || !BOT_SECRET || ADMIN_IDS.length === 0) {
  console.error("[pack-bot] Нет обязательных env: PACK_BOT_TOKEN, BOT_UPLOAD_SECRET или PACK_BOT_ADMIN_IDS");
  process.exit(1);
}

// Человекочитаемые подписи настроений и версий.
const MOOD_LABELS = { WARM_UP: "🌅 Разогрев", PRIME_TIME: "🔥 Прайм-тайм", AFTER_PARTY: "🌙 Афте-пати" };
const VERSION_LABELS = { ORIGINAL: "🎵 Оригинал", EXTENDED: "⏳ Extended", REMIX: "🔀 Ремикс", MASHUP: "🎚 Мэшап" };

// ─── Sessions (in-memory FSM) ──────────────────────────────────────────────
const sessions = new Map();
// { state, data: { genres:[], moods:[], versions:[], count, tracks:[], artworkFileId, artworkMime, title, description } }

function getSession(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, { state: "MAIN_MENU", data: freshData() });
  return sessions.get(chatId);
}
function freshData() {
  return { genres: [], moods: [], versions: [], count: null, tracks: [], artworkFileId: null, artworkMime: null, title: null, description: null };
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, "x-bot-secret": BOT_SECRET },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function tgFetch(method, body) {
  if (body && !body.reply_markup) delete body.reply_markup;
  const isMultipart = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: isMultipart ? undefined : { "content-type": "application/json" },
    body: isMultipart ? body : JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`TG ${method}: ${data.description}`);
  return data.result;
}

const sendMessage = (chatId, text, replyMarkup = null) =>
  tgFetch("sendMessage", { chat_id: chatId, text, reply_markup: replyMarkup, parse_mode: "HTML" });
const editMessageText = (chatId, messageId, text, replyMarkup = null) =>
  tgFetch("editMessageText", { chat_id: chatId, message_id: messageId, text, reply_markup: replyMarkup, parse_mode: "HTML" });
const answerCallbackQuery = (id, text = "") => tgFetch("answerCallbackQuery", { callback_query_id: id, text });

function chunk(arr, size) {
  const r = [];
  for (let i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size));
  return r;
}

// ─── Steps ─────────────────────────────────────────────────────────────────
async function showMainMenu(chatId, messageId = null) {
  const s = getSession(chatId);
  s.state = "MAIN_MENU";
  s.data = freshData();
  const text = "🎧 <b>ForzaDJ · Конструктор паков</b>\n\nСобери подборку треков за пару шагов.";
  const markup = { inline_keyboard: [[{ text: "➕ Создать пак", callback_data: "action:create" }]] };
  if (messageId) await editMessageText(chatId, messageId, text, markup).catch(() => sendMessage(chatId, text, markup));
  else await sendMessage(chatId, text, markup);
}

async function stepGenre(chatId, messageId) {
  const s = getSession(chatId);
  s.state = "SELECT_GENRE";
  const { genres } = await apiFetch("/api/bot/packs/meta");
  const sel = s.data.genres;
  const btns = genres.map((g) => ({
    text: `${sel.includes(g.slug) ? "✅" : "▫️"} ${g.name}`,
    callback_data: `g:${g.slug}`,
  }));
  const text =
    "<b>Шаг 1/5 · Жанры</b> 🎼\nВыбери сколько угодно (или пропусти — тогда все жанры).\n" +
    (sel.length ? `\nВыбрано: <b>${sel.length}</b>` : "");
  const markup = {
    inline_keyboard: [
      ...chunk(btns, 2),
      [{ text: "➡️ Далее", callback_data: "g:NEXT" }, { text: "⏭ Пропустить", callback_data: "g:SKIP" }],
      [{ text: "⬅️ Назад", callback_data: "back:menu" }],
    ],
  };
  await editMessageText(chatId, messageId, text, markup);
}

async function stepMood(chatId, messageId) {
  const s = getSession(chatId);
  s.state = "SELECT_MOOD";
  const { moods } = await apiFetch("/api/bot/packs/meta");
  const sel = s.data.moods;
  const btns = moods.map((m) => ({
    text: `${sel.includes(m) ? "✅" : "▫️"} ${MOOD_LABELS[m] || m}`,
    callback_data: `m:${m}`,
  }));
  const text =
    "<b>Шаг 2/5 · Настроение</b> 🎭\nМожно несколько, одно или пропустить (тогда любое).\n" +
    (sel.length ? `\nВыбрано: <b>${sel.length}</b>` : "");
  const markup = {
    inline_keyboard: [
      ...chunk(btns, 2),
      [{ text: "➡️ Далее", callback_data: "m:NEXT" }, { text: "⏭ Пропустить", callback_data: "m:SKIP" }],
      [{ text: "⬅️ Назад", callback_data: "back:genre" }],
    ],
  };
  await editMessageText(chatId, messageId, text, markup);
}

async function stepVersion(chatId, messageId) {
  const s = getSession(chatId);
  s.state = "SELECT_VERSION";
  const { versions } = await apiFetch("/api/bot/packs/meta");
  const sel = s.data.versions;
  const btns = versions.map((v) => ({
    text: `${sel.includes(v) ? "✅" : "▫️"} ${VERSION_LABELS[v] || v}`,
    callback_data: `v:${v}`,
  }));
  const text =
    "<b>Шаг 3/5 · Версии</b> 💿\nМультивыбор: оригинал, ремикс и т.д. (или пропусти — тогда любые).\n" +
    (sel.length ? `\nВыбрано: <b>${sel.length}</b>` : "");
  const markup = {
    inline_keyboard: [
      ...chunk(btns, 2),
      [{ text: "➡️ Далее", callback_data: "v:NEXT" }, { text: "⏭ Пропустить", callback_data: "v:SKIP" }],
      [{ text: "⬅️ Назад", callback_data: "back:mood" }],
    ],
  };
  await editMessageText(chatId, messageId, text, markup);
}

async function stepCount(chatId, messageId) {
  const s = getSession(chatId);
  s.state = "SELECT_COUNT";
  const text = "<b>Шаг 4/5 · Количество треков</b> 🔢\nСколько треков в паке (максимум 20)?";
  const markup = {
    inline_keyboard: [
      [
        { text: "5", callback_data: "ct:5" },
        { text: "10", callback_data: "ct:10" },
        { text: "20", callback_data: "ct:20" },
      ],
      [{ text: "⬅️ Назад", callback_data: "back:version" }, { text: "❌ Отмена", callback_data: "action:cancel" }],
    ],
  };
  await editMessageText(chatId, messageId, text, markup);
}

function buildSearchQuery(d) {
  const p = new URLSearchParams({ limit: String(d.count) });
  if (d.genres.length) p.set("genres", d.genres.join(","));
  if (d.moods.length) p.set("moods", d.moods.join(","));
  if (d.versions.length) p.set("types", d.versions.join(","));
  return p.toString();
}

function criteriaLine(d) {
  const g = d.genres.length ? d.genres.join(", ") : "все";
  const m = d.moods.length ? d.moods.map((x) => (MOOD_LABELS[x] || x).replace(/^\S+\s/, "")).join(", ") : "любое";
  const v = d.versions.length ? d.versions.map((x) => (VERSION_LABELS[x] || x).replace(/^\S+\s/, "")).join(", ") : "любые";
  return `🎼 <b>Жанры:</b> ${g}\n🎭 <b>Настроение:</b> ${m}\n💿 <b>Версии:</b> ${v}`;
}

async function stepPreview(chatId, messageId, research = true) {
  const s = getSession(chatId);
  s.state = "PREVIEW";
  const d = s.data;

  if (research) {
    const res = await apiFetch(`/api/bot/packs/search?${buildSearchQuery(d)}`);
    d.tracks = res.tracks || [];
    d._available = res.available ?? d.tracks.length;
    d._excluded = res.excludedUsed ?? 0;
  }

  if (!d.tracks.length) {
    await editMessageText(
      chatId,
      messageId,
      "😕 По этим фильтрам треков не нашлось (возможно, все уже вошли в похожие паки).\n\n" + criteriaLine(d),
      { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "back:count" }], [{ text: "❌ Отмена", callback_data: "action:cancel" }]] },
    );
    return;
  }

  const list = d.tracks.map((t, i) => `${i + 1}. ${t.artist} — ${t.title}`).join("\n");
  const short =
    d.tracks.length < d.count
      ? `\n\n⚠️ Доступно только <b>${d.tracks.length}</b> из ${d.count} (остальное уже использовано в похожих паках).`
      : "";
  const text = `<b>Шаг 5/5 · Превью</b> 👀\n${criteriaLine(d)}\n\n${list}${short}\n\nОдобрить этот список?`;
  const markup = {
    inline_keyboard: [
      [{ text: "✅ Одобрить", callback_data: "pv:approve" }, { text: "🔄 Пересобрать", callback_data: "pv:regen" }],
      [{ text: "⬅️ Назад", callback_data: "back:count" }, { text: "❌ Отмена", callback_data: "action:cancel" }],
    ],
  };
  await editMessageText(chatId, messageId, text, markup);
}

async function stepArtwork(chatId, messageId) {
  const s = getSession(chatId);
  s.state = "AWAIT_ARTWORK";
  const text =
    "<b>Обложка</b> 🖼\nПришли картинку (JPEG / PNG / WebP).\n" +
    "• как <i>фото</i> — Telegram сожмёт в JPEG;\n" +
    "• как <i>файл</i> — сохранится оригинал (в т.ч. WebP).";
  const markup = {
    inline_keyboard: [[{ text: "⏭ Без обложки", callback_data: "art:skip" }, { text: "⬅️ Назад", callback_data: "back:preview" }]],
  };
  if (messageId) await editMessageText(chatId, messageId, text, markup);
  else await sendMessage(chatId, text, markup);
}

async function stepTitle(chatId) {
  getSession(chatId).state = "AWAIT_TITLE";
  await sendMessage(chatId, "<b>Название пака</b> ✏️\nПришли текст названия.\n\n(<i>назад</i> — вернуться к обложке)");
}

async function stepDesc(chatId) {
  getSession(chatId).state = "AWAIT_DESC";
  await sendMessage(chatId, "<b>Описание</b> 📝\nПришли описание или напиши <b>-</b> чтобы пропустить.\n\n(<i>назад</i> — к названию)");
}

async function stepFinal(chatId) {
  const s = getSession(chatId);
  s.state = "FINAL";
  const d = s.data;
  const text =
    `<b>Проверка перед публикацией</b> ✅\n\n` +
    `📛 <b>Название:</b> ${d.title}\n` +
    `📝 <b>Описание:</b> ${d.description || "—"}\n` +
    `🎵 <b>Треков:</b> ${d.tracks.length}\n` +
    `🖼 <b>Обложка:</b> ${d.artworkFileId ? "есть" : "нет"}\n\n` +
    criteriaLine(d);
  const markup = {
    inline_keyboard: [
      [{ text: "🚀 Опубликовать", callback_data: "final:PUBLISHED" }, { text: "💾 В черновик", callback_data: "final:DRAFT" }],
      [{ text: "⬅️ Назад", callback_data: "back:desc" }, { text: "❌ Отмена", callback_data: "action:cancel" }],
    ],
  };
  if (d.artworkFileId) {
    await tgFetch("sendPhoto", { chat_id: chatId, photo: d.artworkFileId, caption: text, reply_markup: markup, parse_mode: "HTML" });
  } else {
    await sendMessage(chatId, text, markup);
  }
}

async function submitPack(chatId, status) {
  const s = getSession(chatId);
  const d = s.data;
  await sendMessage(chatId, "⏳ Создаю пак, секунду…");
  try {
    const fd = new FormData();
    fd.append("title", d.title);
    if (d.description && d.description !== "-") fd.append("description", d.description);
    fd.append("tracks", JSON.stringify(d.tracks.map((t) => t.versionId)));
    fd.append("status", status);
    fd.append("genres", d.genres.join(","));
    fd.append("moods", d.moods.join(","));
    fd.append("versions", d.versions.join(","));

    if (d.artworkFileId) {
      const meta = await tgFetch("getFile", { file_id: d.artworkFileId });
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${meta.file_path}`;
      const imgRes = await fetch(fileUrl);
      const mime = d.artworkMime || "image/jpeg";
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const blob = new Blob([await imgRes.arrayBuffer()], { type: mime });
      fd.append("artwork", blob, `cover.${ext}`);
    }

    const res = await fetch(`${API_URL}/api/bot/packs/create`, {
      method: "POST",
      headers: { "x-bot-secret": BOT_SECRET },
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    if (result.error) throw new Error(result.error);

    const where = status === "PUBLISHED" ? "🚀 Опубликован" : "💾 Сохранён черновик";
    await sendMessage(chatId, `✅ Пак готов!\n${where}\n\n🔗 ${result.url}`);
    await showMainMenu(chatId);
  } catch (err) {
    await sendMessage(chatId, `❌ Ошибка при создании пака:\n${err.message}`);
    await showMainMenu(chatId);
  }
}

// ─── Update processors ───────────────────────────────────────────────────────
function toggle(arr, val) {
  const i = arr.indexOf(val);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(val);
}

async function processCallback(update) {
  const q = update.callback_query;
  const chatId = q.message.chat.id;
  const messageId = q.message.message_id;
  const data = q.data;
  const s = getSession(chatId);

  try {
    if (data === "action:cancel") {
      await answerCallbackQuery(q.id, "Отменено");
      if (q.message.photo) await sendMessage(chatId, "❌ Отменено.");
      else await editMessageText(chatId, messageId, "❌ Отменено.").catch(() => {});
      return showMainMenu(chatId);
    }
    if (data === "action:create") {
      await answerCallbackQuery(q.id);
      return stepGenre(chatId, messageId);
    }

    // Назад
    if (data.startsWith("back:")) {
      await answerCallbackQuery(q.id);
      const to = data.split(":")[1];
      if (to === "menu") return showMainMenu(chatId, messageId);
      if (to === "genre") return stepGenre(chatId, messageId);
      if (to === "mood") return stepMood(chatId, messageId);
      if (to === "version") return stepVersion(chatId, messageId);
      if (to === "count") return stepCount(chatId, messageId);
      if (to === "preview") return stepPreview(chatId, messageId, false);
      if (to === "desc") return stepDesc(chatId);
      return;
    }

    // Жанры (мультивыбор)
    if (data.startsWith("g:")) {
      const v = data.slice(2);
      if (v === "NEXT" || v === "SKIP") {
        if (v === "SKIP") s.data.genres = [];
        await answerCallbackQuery(q.id);
        return stepMood(chatId, messageId);
      }
      toggle(s.data.genres, v);
      await answerCallbackQuery(q.id);
      return stepGenre(chatId, messageId);
    }

    // Настроения (мультивыбор)
    if (data.startsWith("m:")) {
      const v = data.slice(2);
      if (v === "NEXT" || v === "SKIP") {
        if (v === "SKIP") s.data.moods = [];
        await answerCallbackQuery(q.id);
        return stepVersion(chatId, messageId);
      }
      toggle(s.data.moods, v);
      await answerCallbackQuery(q.id);
      return stepMood(chatId, messageId);
    }

    // Версии (мультивыбор)
    if (data.startsWith("v:")) {
      const v = data.slice(2);
      if (v === "NEXT" || v === "SKIP") {
        if (v === "SKIP") s.data.versions = [];
        await answerCallbackQuery(q.id);
        return stepCount(chatId, messageId);
      }
      toggle(s.data.versions, v);
      await answerCallbackQuery(q.id);
      return stepVersion(chatId, messageId);
    }

    if (data.startsWith("ct:")) {
      s.data.count = parseInt(data.slice(3), 10);
      await answerCallbackQuery(q.id, "Ищу треки…");
      return stepPreview(chatId, messageId, true);
    }

    if (data.startsWith("pv:")) {
      const act = data.slice(3);
      if (act === "regen") {
        await answerCallbackQuery(q.id, "Пересобираю…");
        return stepPreview(chatId, messageId, true);
      }
      if (act === "approve") {
        await answerCallbackQuery(q.id);
        return stepArtwork(chatId, messageId);
      }
    }

    if (data === "art:skip") {
      await answerCallbackQuery(q.id);
      s.data.artworkFileId = null;
      s.data.artworkMime = null;
      return stepTitle(chatId);
    }

    if (data.startsWith("final:")) {
      const status = data.split(":")[1];
      await answerCallbackQuery(q.id);
      if (q.message.photo) {
        await tgFetch("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: null }).catch(() => {});
      } else {
        await editMessageText(chatId, messageId, "⏳ Обрабатываю…").catch(() => {});
      }
      return submitPack(chatId, status);
    }

    await answerCallbackQuery(q.id);
  } catch (err) {
    console.error("[pack-bot] callback err", err);
    await answerCallbackQuery(q.id, "Произошла ошибка").catch(() => {});
  }
}

async function processMessage(update) {
  const msg = update.message;
  if (!msg || !msg.from) return;
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  const lower = text.toLowerCase();

  if (text === "/start" || text === "/cancel" || lower === "меню") {
    return showMainMenu(chatId);
  }

  const s = getSession(chatId);

  if (s.state === "AWAIT_ARTWORK") {
    if (lower === "назад") return stepArtwork(chatId);
    if (lower === "/skip" || lower === "-") {
      s.data.artworkFileId = null;
      s.data.artworkMime = null;
      return stepTitle(chatId);
    }
    // Фото (Telegram сжимает в JPEG)
    if (msg.photo && msg.photo.length > 0) {
      s.data.artworkFileId = msg.photo[msg.photo.length - 1].file_id;
      s.data.artworkMime = "image/jpeg";
      return stepTitle(chatId);
    }
    // Файл-документ (сохраняет оригинал, в т.ч. WebP)
    if (msg.document) {
      const mime = (msg.document.mime_type || "").toLowerCase();
      if (["image/jpeg", "image/png", "image/webp"].includes(mime)) {
        s.data.artworkFileId = msg.document.file_id;
        s.data.artworkMime = mime;
        return stepTitle(chatId);
      }
      return sendMessage(chatId, "⚠️ Нужен JPEG, PNG или WebP. Пришли картинку или напиши «Без обложки».");
    }
    return sendMessage(chatId, "🖼 Пришли картинку (фото или файл JPEG/PNG/WebP) либо «-» чтобы пропустить.");
  }

  if (s.state === "AWAIT_TITLE") {
    if (lower === "назад") return stepArtwork(chatId);
    if (text.length > 0) {
      s.data.title = text.slice(0, 300);
      return stepDesc(chatId);
    }
    return;
  }

  if (s.state === "AWAIT_DESC") {
    if (lower === "назад") return stepTitle(chatId);
    if (text.length > 0) {
      s.data.description = text === "-" ? null : text.slice(0, 1000);
      return stepFinal(chatId);
    }
  }
}

// ─── Main loop ───────────────────────────────────────────────────────────────
async function processUpdate(update) {
  const fromId = String(update.message?.from?.id || update.callback_query?.from?.id);
  if (!ADMIN_IDS.includes(fromId)) {
    console.log(`[pack-bot] Неавторизованный пользователь: ${fromId}`);
    return;
  }
  if (update.callback_query) await processCallback(update);
  else if (update.message) await processMessage(update);
}

let offset = 0;
async function poll() {
  console.log(`[pack-bot] Старт polling… (админы: ${ADMIN_IDS.join(", ")})`);
  while (true) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=50&offset=${offset}&allowed_updates=["message","callback_query"]`,
        { signal: AbortSignal.timeout(60_000) },
      );
      if (!res.ok) {
        const waitMs = res.status === 409 ? 15_000 : 5_000;
        console.error("[pack-bot] getUpdates HTTP", res.status, "- повтор через", waitMs / 1000, "с");
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      const data = await res.json();
      if (!data.ok) {
        console.error("[pack-bot] getUpdates error:", data.description);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const update of data.result) {
        await processUpdate(update).catch((err) => console.error("[pack-bot] processUpdate error:", err.message));
        offset = update.update_id + 1;
      }
    } catch (err) {
      if (err.name !== "TimeoutError" && err.name !== "AbortError") {
        console.error("[pack-bot] poll error:", err.message);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

poll();
