/**
 * Разовая чистка жанров (этап «жанры и версии»):
 *  - RUS → Rus (переименование отображаемого имени, slug не меняется);
 *  - Afro → Afro House, Deep House → House: переносим связи треков на целевой
 *    жанр (с защитой от дублей по PK track_id+genre_id) и удаляем старый жанр.
 *
 * Идемпотентно. Запуск на сервере:  cd /opt/forzadj && node scripts/cleanup-genres.mjs
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
const pick = (k) => {
  const m = raw.match(
    new RegExp(`^${k}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^#\\r\\n]*))`, "m"),
  );
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? "").trim() || null;
};
const url = pick("DIRECT_URL") ?? pick("DATABASE_URL");
if (!url) throw new Error("Не найдены DIRECT_URL/DATABASE_URL");

// [удаляемый slug, целевой slug]
const MERGES = [
  ["afro", "afro-house"],
  ["deep-house", "house"],
];

async function main() {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    // RUS → Rus
    const r = await c.query(
      `UPDATE genres SET name = 'Rus', updated_at = now()
       WHERE slug = 'rus' AND name <> 'Rus' AND deleted_at IS NULL`,
    );
    console.log(r.rowCount > 0 ? "~ RUS → Rus" : "= RUS уже Rus (или нет)");

    for (const [fromSlug, toSlug] of MERGES) {
      const from = await c.query("SELECT id FROM genres WHERE slug=$1", [fromSlug]);
      const to = await c.query("SELECT id FROM genres WHERE slug=$1", [toSlug]);
      if (from.rows.length === 0) {
        console.log(`= ${fromSlug}: уже удалён`);
        continue;
      }
      const fromId = from.rows[0].id;
      if (to.rows.length === 0) {
        console.log(`! ${fromSlug}: целевой ${toSlug} не найден — пропуск`);
        continue;
      }
      const toId = to.rows[0].id;

      // Переносим связи, где у трека ещё нет целевого жанра.
      const moved = await c.query(
        `UPDATE track_genres tg SET genre_id = $2
         WHERE tg.genre_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM track_genres t2
             WHERE t2.track_id = tg.track_id AND t2.genre_id = $2
           )`,
        [fromId, toId],
      );
      // Остатки (трек уже имел целевой жанр) — просто удаляем связь.
      const dropped = await c.query(
        "DELETE FROM track_genres WHERE genre_id = $1",
        [fromId],
      );
      await c.query("DELETE FROM genres WHERE id = $1", [fromId]);
      console.log(
        `✓ ${fromSlug} → ${toSlug}: перенесено ${moved.rowCount}, снято дублей ${dropped.rowCount}, жанр удалён`,
      );
    }

    const rows = await c.query(
      "SELECT name FROM genres WHERE deleted_at IS NULL ORDER BY name",
    );
    console.log(`\nИтоговый список жанров (${rows.rows.length}):`);
    console.log(rows.rows.map((x) => "  " + x.name).join("\n"));
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("Ошибка чистки жанров:", e);
  process.exit(1);
});
