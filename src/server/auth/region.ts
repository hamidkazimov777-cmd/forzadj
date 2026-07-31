import { headers } from "next/headers";

/**
 * Определение региона пользователя по IP — источник истины для выбора
 * допустимого способа входа (требования 149-ФЗ/406-ФЗ). Значение берётся
 * из заголовка `CF-IPCountry`, который проставляет Cloudflare перед нашим
 * сервером. Самодекларация пользователя НЕ используется как гейт.
 *
 * Если страну определить не удалось (заголовок отсутствует — dev/локально или
 * проксирование выключено), считаем регионом РФ (наиболее строгий вариант:
 * не предлагаем иностранные способы входа тому, кого не смогли геолоцировать).
 */
export type Region = "RU" | "OTHER";

export async function detectRegion(): Promise<Region> {
  const h = await headers();
  const country = h.get("cf-ipcountry")?.trim().toUpperCase();
  if (!country || country === "XX" || country === "T1") return "RU";
  return country === "RU" ? "RU" : "OTHER";
}
