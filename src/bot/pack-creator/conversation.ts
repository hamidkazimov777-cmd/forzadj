import { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import { AuthContext } from "./auth";
import { prisma } from "@/server/repositories/prisma";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { getStorage } from "@/server/storage";
import { uniqueSlug } from "@/lib/slug";
import type { TrackMood } from "@prisma/client";
import { TrackCardDto } from "@/types/catalog";

export type BotContext = AuthContext & {
  conversation: any; // Simplified for this scope, grammy injects it
};

export type PackConversation = Conversation<BotContext>;

async function selectMultiple(
  conversation: PackConversation,
  ctx: BotContext,
  items: { id: string; label: string }[],
  prompt: string
): Promise<string[]> {
  const selected = new Set<string>();

  const getKeyboard = () => {
    const kb = new InlineKeyboard();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const check = selected.has(item.id) ? "✅ " : "";
      kb.text(`${check}${item.label}`, `toggle_${item.id}`);
      if (i % 2 !== 0) kb.row();
    }
    kb.row().text("➡️ Готово", "done");
    return kb;
  };

  await ctx.reply(prompt, { reply_markup: getKeyboard() });

  while (true) {
    const callbackCtx = await conversation.waitForCallbackQuery(/toggle_|done/);
    await callbackCtx.answerCallbackQuery();

    const data = callbackCtx.callbackQuery.data;
    if (data === "done") {
      await callbackCtx.editMessageReplyMarkup({ reply_markup: undefined });
      break;
    } else if (data.startsWith("toggle_")) {
      const id = data.replace("toggle_", "");
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);

      await callbackCtx.editMessageReplyMarkup({ reply_markup: getKeyboard() });
    }
  }

  return Array.from(selected);
}

async function selectSingle(
  conversation: PackConversation,
  ctx: BotContext,
  items: { id: string; label: string }[],
  prompt: string
): Promise<string | undefined> {
  const kb = new InlineKeyboard();
  for (let i = 0; i < items.length; i++) {
    kb.text(items[i].label, `select_${items[i].id}`);
    if (i % 2 !== 0) kb.row();
  }
  kb.row().text("Пропустить", "skip");

  await ctx.reply(prompt, { reply_markup: kb });

  const callbackCtx = await conversation.waitForCallbackQuery(/select_|skip/);
  await callbackCtx.answerCallbackQuery();
  await callbackCtx.editMessageReplyMarkup({ reply_markup: undefined });

  const data = callbackCtx.callbackQuery.data;
  if (data === "skip") return undefined;
  return data.replace("select_", "");
}

/**
 * Бот — отдельный Node-процесс вне Next.js, поэтому не может звать
 * revalidateTag/revalidatePath напрямую. После записи пака в БД дёргаем
 * внутренний роут сайта, который сбрасывает кэш списков паков (/packs и
 * /studio/collections). Секрет — тот же BOT_UPLOAD_SECRET, что и у аплоада.
 * Ошибки глотаем: неудавшаяся ревалидация не должна ронять сценарий бота —
 * данные всё равно подтянутся после истечения 5-мин TTL кэша.
 */
async function triggerRevalidate(slug?: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.BOT_UPLOAD_SECRET;
  if (!appUrl || !secret) {
    console.warn("[PackBot] revalidate skipped: NEXT_PUBLIC_APP_URL or BOT_UPLOAD_SECRET missing");
    return;
  }
  try {
    const res = await fetch(`${appUrl}/api/bot/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bot-secret": secret },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      console.error(`[PackBot] revalidate failed: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error("[PackBot] revalidate error:", err);
  }
}

function formatTracklist(tracks: TrackCardDto[]): string {
  if (tracks.length === 0) return "Треки не найдены.";
  let msg = `Найдено треков: ${tracks.length}\n\n`;
  tracks.slice(0, 30).forEach((t, i) => {
    const artistStr = t.artists.map(a => a.name).join(", ");
    msg += `${i + 1}. ${artistStr} - ${t.title}\n`;
  });
  if (tracks.length > 30) {
    msg += `...и еще ${tracks.length - 30} треков.\n`;
  }
  return msg;
}

export async function packCreatorConversation(conversation: PackConversation, ctx: BotContext) {
  // 1. Название и описание
  await ctx.reply("Давайте создадим новый пак. Пожалуйста, введите название пака:");
  const titleCtx = await conversation.waitFor(":text");
  const title = titleCtx.message!.text;

  await ctx.reply("Теперь введите описание пака (или напишите 'пропустить'):");
  const descCtx = await conversation.waitFor(":text");
  const descriptionInput = descCtx.message!.text;
  const description = descriptionInput.toLowerCase() === "пропустить" ? undefined : descriptionInput;

  // 2. Выбор жанров
  const dbGenres = await conversation.external(() => prisma.genre.findMany({ select: { slug: true, name: true } }));
  const selectedGenres = await selectMultiple(
    conversation,
    ctx,
    dbGenres.map(g => ({ id: g.slug, label: g.name })),
    "Выберите жанры (можно несколько):"
  );

  // 3. Выбор настроения
  const moods = [
    { id: "WARM_UP", label: "Warm Up" },
    { id: "PRIME_TIME", label: "Prime Time" },
    { id: "AFTER_PARTY", label: "After Party" },
  ];
  const selectedMood = await selectSingle(
    conversation,
    ctx,
    moods,
    "Выберите настроение пака:"
  ) as TrackMood | undefined;

  // 4. Подбор треков
  await ctx.reply("Ищу треки по вашим критериям...");
  const searchResult = await conversation.external(() =>
    catalogRepository.search({
      genres: selectedGenres.length > 0 ? selectedGenres : undefined,
      mood: selectedMood,
      page: 1, // берем первую страницу (до 40 треков, см PAGE_SIZE в репозитории)
    })
  );

  const tracks = searchResult.items;
  if (tracks.length === 0) {
    await ctx.reply("По этим критериям не найдено ни одного трека. Отмена создания пака.");
    return;
  }

  // 5. Ревью треклиста
  await ctx.reply(`Предварительный трек-лист:\n\n${formatTracklist(tracks)}`);
  
  const confirmKb = new InlineKeyboard()
    .text("✅ Подтвердить", "confirm")
    .text("❌ Отменить", "cancel");

  await ctx.reply("Утверждаете этот трек-лист?", { reply_markup: confirmKb });
  const confirmCtx = await conversation.waitForCallbackQuery(["confirm", "cancel"]);
  await confirmCtx.answerCallbackQuery();
  await confirmCtx.editMessageReplyMarkup({ reply_markup: undefined });

  if (confirmCtx.callbackQuery.data === "cancel") {
    await ctx.reply("Создание пака отменено.");
    return;
  }

  // 6. Сохранение пака
  const telegramId = ctx.from!.id.toString();
  const ownerId = await conversation.external(async () => {
    const identity = await prisma.authIdentity.findUnique({
      where: { provider_providerUserId: { provider: "TELEGRAM", providerUserId: telegramId } },
      include: { user: true }
    });
    if (identity?.user) return identity.user.id;
    const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    return admin!.id;
  });

  const slug = uniqueSlug(title);
  
  const pack = await conversation.external(() =>
    collectionRepository.createPack({ title, slug, description, ownerId })
  );

  // Добавление треков в пак
  await conversation.external(async () => {
    for (const track of tracks) {
      if (track.versions.length > 0) {
        // Берем первую версию (обычно ORIGINAL)
        await collectionRepository.addItem(pack.id, track.versions[0].id, ownerId);
      }
    }
  });

  // 8. Публикация
  const publishKb = new InlineKeyboard()
    .text("🚀 Опубликовать (Public)", "publish")
    .text("💾 Сохранить в черновик (Private)", "draft")
    .text("🗑 Удалить", "delete");

  await ctx.reply("Пак успешно создан! Что сделать с ним дальше?", { reply_markup: publishKb });
  const pubCtx = await conversation.waitForCallbackQuery(["publish", "draft", "delete"]);
  await pubCtx.answerCallbackQuery();
  await pubCtx.editMessageReplyMarkup({ reply_markup: undefined });

  if (pubCtx.callbackQuery.data === "publish") {
    await conversation.external(() => collectionRepository.setVisibility(ownerId, pack.id, "PUBLIC"));
    // Публичная витрина + студия + детальная страница пака.
    await conversation.external(() => triggerRevalidate(slug));
    await ctx.reply(`Пак опубликован! Ссылка: ${process.env.NEXT_PUBLIC_APP_URL}/packs/${slug}`);
  } else if (pubCtx.callbackQuery.data === "draft") {
    // Черновик виден только в студии, но список /studio/collections уже изменился.
    await conversation.external(() => triggerRevalidate());
    await ctx.reply("Пак сохранен как черновик. Вы можете отредактировать его позже.");
  } else {
    await conversation.external(() => collectionRepository.softDelete(ownerId, pack.id));
    await conversation.external(() => triggerRevalidate());
    await ctx.reply("Пак удален.");
  }
}
