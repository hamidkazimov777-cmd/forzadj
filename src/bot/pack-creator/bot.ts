import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { AuthContext, requireAdmin } from "./auth";
import { packCreatorConversation } from "./conversation";

if (!process.env.PACK_BOT_TOKEN) {
  throw new Error("PACK_BOT_TOKEN is not defined");
}

export const bot = new Bot<AuthContext>(process.env.PACK_BOT_TOKEN);

// Настройка сессий и плагина conversations
bot.use(session({ initial: () => ({}) }));

// Middleware авторизации должен быть ДО conversations, чтобы ctx.user был доступен при возобновлении!
bot.use(requireAdmin);

bot.use(conversations());

// Регистрация сценария
bot.use(createConversation(packCreatorConversation, "packCreator"));

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привет! Я бот для создания паков (редакционных коллекций).\n" +
    "Отправь /newpack чтобы начать."
  );
});

bot.command("newpack", async (ctx) => {
  await ctx.conversation.enter("packCreator");
});

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  console.error(e);
});

console.log("[PackBot] Starting polling...");
bot.start({
  onStart: (botInfo) => {
    console.log(`[PackBot] Started as @${botInfo.username}`);
  },
});
