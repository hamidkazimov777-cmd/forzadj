import { z } from "zod";
import { gigachatComplete } from "./gigachat.client";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { isRetiredGenreName } from "@/lib/content-metadata";
import { toPlayerTrack, defaultVersionOf, artistLineOf } from "@/lib/player-track";
import { AI_SET, AI_PROMPT_MAX_LEN, aiConfig } from "@/lib/config/ai";
import { TRACK_MOODS } from "@/lib/validators/content";
import { VERSION_TYPES } from "@/lib/content-metadata";
import type { CatalogFilters, TrackCardDto } from "@/types/catalog";
import type { PlayerTrack } from "@/types/player";

/**
 * ИИ-подбор сета на GigaChat. Двухпроходная схема:
 *   1) запрос диджея → структурные фильтры каталога (жанры/BPM/mood/тип);
 *   2) реальный пул кандидатов из БД → ИИ отбирает и упорядочивает связный сет
 *      (энергетическая дуга, соседство по BPM/тональности).
 *
 * ИИ никогда не «придумывает» названия — на выходе только опубликованные треки
 * из нашего каталога. При любой ошибке ИИ есть детерминированный fallback.
 */

export interface AiSetResult {
  title: string;
  explanation: string;
  filters: CatalogFilters;
  items: TrackCardDto[];
  queue: PlayerTrack[];
  /** true — ИИ не отработал, показан запасной результат по ключевым словам. */
  degraded: boolean;
  notice: string | null;
}

const filtersSchema = z.object({
  title: z.string().max(120).optional(),
  explanation: z.string().max(600).optional(),
  count: z.number().int().optional(),
  genres: z.array(z.string()).max(8).optional(),
  bpmMin: z.number().min(40).max(220).optional(),
  bpmMax: z.number().min(40).max(220).optional(),
  mood: z.string().optional(),
  type: z.string().optional(),
  cleanOnly: z.boolean().optional(),
});

const curationSchema = z.object({
  order: z.array(z.number().int()).max(AI_SET.MAX),
  explanation: z.string().max(600).optional(),
});

/** Достаёт первый JSON-объект из ответа модели (на случай обрамляющего текста). */
function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1));
}

function clampCount(n: number | undefined): number {
  if (!Number.isFinite(n)) return AI_SET.DEFAULT;
  return Math.min(AI_SET.MAX, Math.max(AI_SET.MIN, Math.round(n as number)));
}

function buildQueue(items: TrackCardDto[]): PlayerTrack[] {
  const queue: PlayerTrack[] = [];
  for (const t of items) {
    const v = defaultVersionOf(t);
    if (v) queue.push(toPlayerTrack(t, v));
  }
  return queue;
}

/** Ослабляем фильтры по шагам, пока не наберём достаточно кандидатов. */
async function gatherCandidates(
  filters: CatalogFilters,
  need: number,
): Promise<TrackCardDto[]> {
  const attempts: CatalogFilters[] = [
    filters,
    { ...filters, bpmMin: undefined, bpmMax: undefined },
    { ...filters, bpmMin: undefined, bpmMax: undefined, mood: undefined },
    { genres: filters.genres, sort: "popular" },
    { sort: "popular" },
  ];
  let best: TrackCardDto[] = [];
  for (const f of attempts) {
    const pool = await catalogRepository.candidatePool(f, AI_SET.CANDIDATE_POOL);
    if (pool.length > best.length) best = pool;
    if (best.length >= need) break;
  }
  return best;
}

/** Компактная строка кандидата для промпта второго прохода. */
function candidateLine(t: TrackCardDto, i: number): string {
  const v = defaultVersionOf(t);
  const bpm = v?.bpm != null ? Math.round(v.bpm) : "?";
  const key = v?.camelotKey ?? "?";
  const energy = v?.energy != null ? v.energy : "?";
  const genres = t.genres.slice(0, 3).join("/") || "-";
  const mood = t.mood ?? "-";
  return `${i}) ${artistLineOf(t)} — ${t.title} | ${genres} | ${bpm}bpm | ${key} | E${energy} | ${mood}`;
}

/** Итоговый результат из упорядоченного списка карточек. */
function assemble(
  items: TrackCardDto[],
  filters: CatalogFilters,
  title: string,
  explanation: string,
  degraded: boolean,
  notice: string | null,
): AiSetResult {
  return { title, explanation, filters, items, queue: buildQueue(items), degraded, notice };
}

async function fallback(prompt: string, reason: string): Promise<AiSetResult> {
  // Запасной путь без ИИ: поиск по ключевым словам, затем — свежие популярные.
  const byQuery = await catalogRepository.candidatePool(
    { q: prompt.slice(0, 80), sort: "popular" },
    AI_SET.DEFAULT,
  );
  const items = byQuery.length
    ? byQuery
    : await catalogRepository.candidatePool({ sort: "popular" }, AI_SET.DEFAULT);
  return assemble(
    items.slice(0, AI_SET.DEFAULT),
    { q: prompt.slice(0, 80), sort: "popular" },
    "Подборка по каталогу",
    "ИИ временно недоступен — показали подходящие треки из каталога по вашему запросу.",
    true,
    reason,
  );
}

export async function recommendSet(rawPrompt: string): Promise<AiSetResult> {
  const prompt = rawPrompt.trim().slice(0, AI_PROMPT_MAX_LEN);
  if (!prompt) throw new Error("Пустой запрос");
  if (!aiConfig.isConfigured) return fallback(prompt, "GigaChat не настроен");

  // Реальные жанры С КОЛИЧЕСТВОМ треков — ИИ выбирает слаги только из этого
  // списка и предпочитает наполненные жанры. Пустые жанры не показываем вовсе,
  // чтобы ИИ не отправлял выборку в заведомо пустой фильтр.
  const genres = (await catalogRepository.listGenresWithCounts())
    .filter((g) => g._count.tracks > 0 && !isRetiredGenreName(g.name))
    .sort((a, b) => b._count.tracks - a._count.tracks);
  const genreCatalog = genres
    .map((g) => `${g.slug} (${g.name}, ${g._count.tracks} треков)`)
    .join(", ");

  // ---- Проход 1: запрос → фильтры ----
  let parsedFilters: z.infer<typeof filtersSchema>;
  try {
    const raw = await gigachatComplete(
      [
        {
          role: "system",
          content:
            "Ты — музыкальный редактор диджей-пула. По описанию вечеринки подбираешь параметры для выборки треков из каталога. " +
            "Отвечай СТРОГО одним JSON-объектом без пояснений вокруг. Поля: " +
            "title (короткое название сета), explanation (1-2 предложения, почему такой подбор), " +
            "count (сколько треков, число), genres (массив СЛАГОВ строго из списка ниже), " +
            "bpmMin, bpmMax (числа), mood (одно из WARM_UP|PRIME_TIME|AFTER_PARTY), " +
            "type (ORIGINAL|EXTENDED|REMIX|MASHUP, если явно нужно), cleanOnly (true если просят без мата). " +
            "ВАЖНО про жанры: используй ТОЛЬКО слаги из списка ниже. Если пользователь назвал жанр, " +
            "которого в списке нет (например «techno», «мелодик», «deep»), НЕ выдумывай — подбери " +
            "БЛИЖАЙШИЙ по смыслу из списка (techno→tech-house, мелодик→house/afro-house). " +
            "Предпочитай жанры с бОльшим числом треков. Если пользователь не назвал жанр — не задавай genres вовсе. " +
            "Подсказка по mood: прогрев/разогрев→WARM_UP, пик/прайм-тайм→PRIME_TIME, афтепати/чил→AFTER_PARTY. " +
            "Если параметр не нужен — не включай его.\n" +
            `Доступные жанры (slug (name, число треков)): ${genreCatalog}`,
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3, maxTokens: 500 },
    );
    parsedFilters = filtersSchema.parse(extractJson(raw));
  } catch (e) {
    return fallback(prompt, `Проход 1: ${(e as Error).message}`);
  }

  const validGenreSlugs = new Set(genres.map((g) => g.slug));
  const mood = (TRACK_MOODS as readonly string[]).includes(parsedFilters.mood ?? "")
    ? (parsedFilters.mood as CatalogFilters["mood"])
    : undefined;
  const type = VERSION_TYPES.includes(parsedFilters.type as never)
    ? (parsedFilters.type as CatalogFilters["type"])
    : undefined;
  const bpmMin = parsedFilters.bpmMin;
  const bpmMax = parsedFilters.bpmMax;

  const filters: CatalogFilters = {
    genres: parsedFilters.genres?.filter((s) => validGenreSlugs.has(s)) || undefined,
    bpmMin: bpmMin != null && bpmMax != null ? Math.min(bpmMin, bpmMax) : bpmMin,
    bpmMax: bpmMin != null && bpmMax != null ? Math.max(bpmMin, bpmMax) : bpmMax,
    mood,
    type,
    cleanOnly: parsedFilters.cleanOnly || undefined,
    sort: "popular",
  };
  if (filters.genres && filters.genres.length === 0) filters.genres = undefined;

  const count = clampCount(parsedFilters.count);
  const setTitle = parsedFilters.title?.trim() || "ИИ-сет";
  const setExplanation =
    parsedFilters.explanation?.trim() || "Подобрано под ваш запрос.";

  // ---- Пул кандидатов ----
  const candidates = await gatherCandidates(filters, count);
  if (candidates.length === 0) {
    return fallback(prompt, "Каталог не дал кандидатов под фильтры");
  }
  if (candidates.length <= count) {
    // Курировать нечего — отдаём всё, что нашли, в порядке каталога.
    return assemble(candidates, filters, setTitle, setExplanation, false, null);
  }

  // ---- Проход 2: курирование порядка ----
  try {
    const list = candidates.map(candidateLine).join("\n");
    const raw = await gigachatComplete(
      [
        {
          role: "system",
          content:
            "Ты — диджей, который собирает связный сет из готового пула треков. " +
            "Тебе дан пронумерованный список (индекс с 0). Выбери ЛУЧШИЕ треки под запрос и выстрой их в порядок сведения: " +
            "плавная энергетическая дуга, близкие BPM рядом, по возможности совместимые тональности (Camelot). " +
            "Ответь СТРОГО одним JSON: {\"order\": [индексы в нужном порядке], \"explanation\": \"1-2 предложения\"}. " +
            `Ровно ${count} индексов, только из диапазона списка, без повторов.`,
        },
        { role: "user", content: `Запрос: ${prompt}\n\nПул треков:\n${list}` },
      ],
      { temperature: 0.4, maxTokens: 900 },
    );
    const curated = curationSchema.parse(extractJson(raw));
    const seen = new Set<number>();
    const ordered: TrackCardDto[] = [];
    for (const idx of curated.order) {
      if (idx >= 0 && idx < candidates.length && !seen.has(idx)) {
        seen.add(idx);
        ordered.push(candidates[idx]);
      }
      if (ordered.length >= count) break;
    }
    // Добор, если ИИ вернул меньше нужного.
    if (ordered.length < count) {
      for (let i = 0; i < candidates.length && ordered.length < count; i++) {
        if (!seen.has(i)) ordered.push(candidates[i]);
      }
    }
    const explanation = curated.explanation?.trim() || setExplanation;
    return assemble(ordered, filters, setTitle, explanation, false, null);
  } catch {
    // Курирование не удалось — берём первые count кандидатов (по популярности).
    return assemble(
      candidates.slice(0, count),
      filters,
      setTitle,
      setExplanation,
      false,
      null,
    );
  }
}
