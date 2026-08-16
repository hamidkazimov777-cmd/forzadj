import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
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
const ADMIN_IDS = (process.env.PACK_BOT_ADMIN_IDS || "").split(",").map(s => s.trim());
const BOT_SECRET = process.env.BOT_UPLOAD_SECRET;
const API_URL = process.env.PACK_BOT_API_URL || "http://127.0.0.1:3000";

if (!BOT_TOKEN || !BOT_SECRET || ADMIN_IDS.length === 0) {
  console.error("[pack-bot] Missing required env vars: PACK_BOT_TOKEN, BOT_UPLOAD_SECRET, or PACK_BOT_ADMIN_IDS");
  process.exit(1);
}

// Memory Sessions
const sessions = new Map();
// session structure: { state, data: { genre, mood, version, count, tracks: [...], artworkFileId, title, description } }

async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`;
  console.log(`\n[API REQ] ${path}`);
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "x-bot-secret": BOT_SECRET,
    },
  });
  if (!res.ok) {
    throw new Error(`API Error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  console.log(`[API RES] ${path}: ${JSON.stringify(json, null, 2).slice(0, 300)}...`);
  return json;
}

async function tgFetch(method, body) {
  if (!body.reply_markup) delete body.reply_markup;
  console.log(`\n[TG REQ] ${method}: ${JSON.stringify(body, null, 2)}`);
  const isMultipart = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: isMultipart ? undefined : { "content-type": "application/json" },
    body: isMultipart ? body : JSON.stringify(body),
  });
  const data = await res.json();
  console.log(`[TG RES] ${method}: ${JSON.stringify(data).slice(0, 200)}`);
  if (!data.ok) throw new Error(`TG API Error: ${data.description}`);
  return data.result;
}

async function sendMessage(chatId, text, replyMarkup = null) {
  return tgFetch("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
    parse_mode: "HTML",
  });
}

async function editMessageText(chatId, messageId, text, replyMarkup = null) {
  return tgFetch("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: replyMarkup,
    parse_mode: "HTML",
  });
}

async function answerCallbackQuery(callbackQueryId, text = "") {
  return tgFetch("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { state: "MAIN_MENU", data: {} });
  }
  return sessions.get(chatId);
}

function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// -------------------------------------------------------------
// FSM Handlers
// -------------------------------------------------------------

async function showMainMenu(chatId) {
  const session = getSession(chatId);
  session.state = "MAIN_MENU";
  session.data = {};
  await sendMessage(chatId, "Welcome to ForzaDJ Pack Bot.", {
    inline_keyboard: [[{ text: "Create Pack", callback_data: "action:create" }]]
  });
}

async function stepSelectGenre(chatId, messageId = null) {
  const session = getSession(chatId);
  session.state = "SELECT_GENRE";
  const { genres } = await apiFetch("/api/bot/packs/meta");
  const buttons = genres.map(g => ({ text: g.name, callback_data: `genre:${g.slug}` }));
  const rows = chunkArray(buttons, 2);
  const text = "<b>Step 1:</b> Select Genre (or Skip)";
  const markup = { inline_keyboard: [...rows, [{ text: "Skip", callback_data: "genre:SKIP" }]] };
  
  if (messageId) await editMessageText(chatId, messageId, text, markup);
  else await sendMessage(chatId, text, markup);
}

async function stepSelectMood(chatId, messageId) {
  const session = getSession(chatId);
  session.state = "SELECT_MOOD";
  session.data.versions = []; // initialize array for next step
  const { moods } = await apiFetch("/api/bot/packs/meta");
  const rows = chunkArray(moods.map(m => ({ text: m, callback_data: `mood:${m}` })), 2);
  const text = "<b>Step 2:</b> Select Mood (or Skip)";
  const markup = { inline_keyboard: [...rows, [{ text: "Skip", callback_data: "mood:SKIP" }]] };
  await editMessageText(chatId, messageId, text, markup);
}

async function stepSelectVersion(chatId, messageId) {
  const session = getSession(chatId);
  session.state = "SELECT_VERSION";
  const { versions } = await apiFetch("/api/bot/packs/meta");
  
  const selected = session.data.versions || [];
  const buttons = versions.map(v => {
    const isChecked = selected.includes(v);
    return { text: `${isChecked ? "☑" : "☐"} ${v}`, callback_data: `version:${v}` };
  });
  
  const rows = chunkArray(buttons, 2);
  const text = "<b>Step 3:</b> Select Versions (multi-select)";
  const markup = { 
    inline_keyboard: [
      ...rows, 
      [{ text: "Continue", callback_data: "version:CONTINUE" }],
      [{ text: "Skip", callback_data: "version:SKIP" }]
    ] 
  };
  await editMessageText(chatId, messageId, text, markup);
}

async function stepSelectCount(chatId, messageId) {
  const session = getSession(chatId);
  session.state = "SELECT_COUNT";
  const text = "<b>Step 4:</b> Select Number of Tracks";
  const markup = {
    inline_keyboard: [
      [
        { text: "5", callback_data: "count:5" },
        { text: "10", callback_data: "count:10" },
        { text: "20", callback_data: "count:20" }
      ],
      [{ text: "Cancel", callback_data: "action:cancel" }]
    ]
  };
  await editMessageText(chatId, messageId, text, markup);
}

async function stepPreview(chatId, messageId) {
  const session = getSession(chatId);
  session.state = "PREVIEW";
  const d = session.data;
  
  const query = new URLSearchParams({ limit: d.count });
  if (d.genre && d.genre !== "SKIP") query.set("genre", d.genre);
  if (d.mood && d.mood !== "SKIP") query.set("mood", d.mood);
  if (d.versions && d.versions.length > 0 && !d.versions.includes("SKIP")) {
    query.set("types", d.versions.join(","));
  }

  const { tracks } = await apiFetch(`/api/bot/packs/search?${query.toString()}`);
  d.tracks = tracks;

  if (tracks.length === 0) {
    await editMessageText(chatId, messageId, "No tracks found for these criteria.", {
      inline_keyboard: [[{ text: "Start Over", callback_data: "action:cancel" }]]
    });
    return;
  }

  const list = tracks.map((t, i) => `${i+1}. ${t.artist} - ${t.title}`).join("\n");
  const text = `<b>Preview Pack:</b>\n${list}\n\nApprove this list?`;
  
  const markup = {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: "preview:approve" },
        { text: "🔄 Regenerate", callback_data: "preview:regen" }
      ],
      [{ text: "Cancel", callback_data: "action:cancel" }]
    ]
  };
  await editMessageText(chatId, messageId, text, markup);
}

async function stepAwaitArtwork(chatId, messageId) {
  const session = getSession(chatId);
  session.state = "AWAIT_ARTWORK";
  const text = "<b>Step 5:</b> Send an image for the Pack Cover (or send /skip).";
  if (messageId) await editMessageText(chatId, messageId, text);
  else await sendMessage(chatId, text);
}

async function stepAwaitTitle(chatId) {
  const session = getSession(chatId);
  session.state = "AWAIT_TITLE";
  await sendMessage(chatId, "<b>Step 6:</b> Send the Title of the Pack.");
}

async function stepAwaitDesc(chatId) {
  const session = getSession(chatId);
  session.state = "AWAIT_DESC";
  await sendMessage(chatId, "<b>Step 7:</b> Send the Description of the Pack (or /skip).");
}

async function stepFinal(chatId) {
  const session = getSession(chatId);
  session.state = "FINAL";
  const d = session.data;
  const text = `<b>Final Review:</b>\nTitle: ${d.title}\nDescription: ${d.description || 'None'}\nTracks: ${d.tracks.length}\nArtwork: ${d.artworkFileId ? 'Yes' : 'No'}\n\nPublish or Save as Draft?`;
  const markup = {
    inline_keyboard: [
      [
        { text: "🚀 Publish", callback_data: "final:PUBLISHED" },
        { text: "💾 Save Draft", callback_data: "final:DRAFT" }
      ],
      [{ text: "Cancel", callback_data: "action:cancel" }]
    ]
  };
  
  if (d.artworkFileId) {
    await tgFetch("sendPhoto", { chat_id: chatId, photo: d.artworkFileId, caption: text, reply_markup: markup, parse_mode: "HTML" });
  } else {
    await sendMessage(chatId, text, markup);
  }
}

async function submitPack(chatId, status) {
  const session = getSession(chatId);
  const d = session.data;
  
  await sendMessage(chatId, "Creating pack, please wait...");
  
  try {
    const formData = new FormData();
    formData.append("title", d.title);
    if (d.description && d.description !== "SKIP") formData.append("description", d.description);
    formData.append("tracks", JSON.stringify(d.tracks.map(t => t.versionId)));
    formData.append("status", status);

    if (d.artworkFileId) {
      const fileMeta = await tgFetch("getFile", { file_id: d.artworkFileId });
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileMeta.file_path}`;
      const imgRes = await fetch(fileUrl);
      const imgBlob = new Blob([await imgRes.arrayBuffer()], { type: "image/jpeg" });
      formData.append("artwork", imgBlob, "cover.jpg");
    }

    const res = await fetch(`${API_URL}/api/bot/packs/create`, {
      method: "POST",
      headers: { "x-bot-secret": BOT_SECRET },
      body: formData
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    
    await sendMessage(chatId, `✅ Pack created successfully!\n\nLink: ${result.url}`);
    showMainMenu(chatId);
  } catch (err) {
    await sendMessage(chatId, `❌ Error creating pack: ${err.message}`);
    showMainMenu(chatId);
  }
}

// -------------------------------------------------------------
// Update Processors
// -------------------------------------------------------------

async function processCallback(update) {
  const query = update.callback_query;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  
  const session = getSession(chatId);

  try {
    if (data === "action:cancel") {
      await answerCallbackQuery(query.id, "Cancelled");
      if (query.message.photo) {
        await sendMessage(chatId, "Cancelled.");
      } else {
        await editMessageText(chatId, messageId, "Cancelled.");
      }
      return showMainMenu(chatId);
    }
    
    if (data === "action:create") {
      await answerCallbackQuery(query.id);
      return stepSelectGenre(chatId, messageId);
    }

    if (data.startsWith("genre:")) {
      session.data.genre = data.split(":")[1];
      await answerCallbackQuery(query.id);
      return stepSelectMood(chatId, messageId);
    }

    if (data.startsWith("mood:")) {
      session.data.mood = data.split(":")[1];
      await answerCallbackQuery(query.id);
      return stepSelectVersion(chatId, messageId);
    }

    if (data.startsWith("version:")) {
      const val = data.split(":")[1];
      if (val === "CONTINUE" || val === "SKIP") {
        if (val === "SKIP") session.data.versions = ["SKIP"];
        await answerCallbackQuery(query.id);
        return stepSelectCount(chatId, messageId);
      } else {
        // Toggle logic
        if (!session.data.versions) session.data.versions = [];
        if (session.data.versions.includes(val)) {
          session.data.versions = session.data.versions.filter(v => v !== val);
        } else {
          session.data.versions.push(val);
        }
        await answerCallbackQuery(query.id);
        return stepSelectVersion(chatId, messageId);
      }
    }

    if (data.startsWith("count:")) {
      session.data.count = parseInt(data.split(":")[1], 10);
      await answerCallbackQuery(query.id, "Searching...");
      return stepPreview(chatId, messageId);
    }

    if (data.startsWith("preview:")) {
      const act = data.split(":")[1];
      if (act === "regen") {
        await answerCallbackQuery(query.id, "Regenerating...");
        return stepPreview(chatId, messageId);
      } else if (act === "approve") {
        await answerCallbackQuery(query.id);
        return stepAwaitArtwork(chatId, messageId);
      }
    }

    if (data.startsWith("final:")) {
      const status = data.split(":")[1];
      await answerCallbackQuery(query.id);
      if (query.message.photo) {
        await tgFetch("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: null }).catch(()=>{});
      } else {
        await editMessageText(chatId, messageId, "Processing...");
      }
      return submitPack(chatId, status);
    }
    
    await answerCallbackQuery(query.id);
  } catch (err) {
    console.error("[pack-bot] callback err", err);
    await answerCallbackQuery(query.id, "Error occurred");
  }
}

async function processMessage(update) {
  const msg = update.message;
  if (!msg || !msg.from) return;
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  // Handle commands
  if (text === "/start" || text === "/cancel") {
    return showMainMenu(chatId);
  }

  const session = getSession(chatId);
  const state = session.state;

  if (state === "AWAIT_ARTWORK") {
    if (text.toLowerCase() === "/skip") {
      session.data.artworkFileId = null;
      return stepAwaitTitle(chatId);
    }
    if (msg.photo && msg.photo.length > 0) {
      // Get the largest size photo
      const photo = msg.photo[msg.photo.length - 1];
      session.data.artworkFileId = photo.file_id;
      return stepAwaitTitle(chatId);
    } else {
      await sendMessage(chatId, "Please send a photo or type /skip");
    }
  } 
  else if (state === "AWAIT_TITLE") {
    if (text.length > 0) {
      session.data.title = text;
      return stepAwaitDesc(chatId);
    }
  }
  else if (state === "AWAIT_DESC") {
    if (text.length > 0) {
      session.data.description = text.toLowerCase() === "/skip" ? null : text;
      return stepFinal(chatId);
    }
  }
}

// -------------------------------------------------------------
// Main Loop
// -------------------------------------------------------------

async function processUpdate(update) {
  const fromId = String(
    update.message?.from?.id || 
    update.callback_query?.from?.id
  );
  
  if (!ADMIN_IDS.includes(fromId)) {
    console.log(`[pack-bot] Unauthorized user: ${fromId}`);
    return;
  }

  if (update.callback_query) {
    await processCallback(update);
  } else if (update.message) {
    await processMessage(update);
  }
}

let offset = 0;

async function poll() {
  console.log(`[pack-bot] Starting polling... (Admin IDs: ${ADMIN_IDS.join(", ")})`);
  while (true) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=50&offset=${offset}&allowed_updates=["message","callback_query"]`,
        { signal: AbortSignal.timeout(60_000) }
      );
      if (!res.ok) {
        const waitMs = res.status === 409 ? 15_000 : 5_000;
        console.error("[pack-bot] getUpdates HTTP", res.status, "- retry in", waitMs / 1000, "s");
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
        await processUpdate(update).catch((err) =>
          console.error("[pack-bot] processUpdate error:", err.message)
        );
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
