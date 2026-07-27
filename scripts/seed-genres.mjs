/**
 * Идемпотентный сид жанров: добавляет новые жанры и переименовывает
 * Dance → EDM. Жанры — обычные строки таблицы genres (name + slug),
 * поэтому новые сразу работают в загрузке, редактировании, фильтрах,
 * поиске и отображении (везде читаются из БД).
 *
 * Запуск:  node scripts/seed-genres.mjs [путь-к-.env]
 * Берёт DIRECT_URL (или DATABASE_URL) из .env — прямое подключение
 * предпочтительнее пула для разовой миграции данных.
 *
 * Слаги совпадают с app-функцией slugify (латиница: lower + '-').
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const envPath = process.argv[2] ?? ".env";

function loadUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = readFileSync(envPath, "utf8");
  const pick = (key) => {
    const m = raw.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  };
  const url = pick("DIRECT_URL") ?? pick("DATABASE_URL");
  if (!url) throw new Error("DIRECT_URL/DATABASE_URL не найдены");
  return url;
}

function slugify(input) {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}

const NEW_GENRES = [
  "Afro House",
  "Mashup",
  "Remix",
  "RUS",
  "Open Format",
  "Garage",
  "Breaks",
  "Jersey Club",
  "Baile Funk",
];

async function main() {
  const client = new pg.Client({ connectionString: loadUrl() });
  await client.connect();
  try {
    for (const name of NEW_GENRES) {
      const slug = slugify(name);
      const res = await client.query(
        `INSERT INTO genres (id, name, slug, created_at, updated_at)
         SELECT gen_random_uuid(), $1, $2, now(), now()
         WHERE NOT EXISTS (
           SELECT 1 FROM genres WHERE slug = $2 AND deleted_at IS NULL
         )`,
        [name, slug],
      );
      console.log(
        res.rowCount > 0 ? `+ добавлен: ${name} (${slug})` : `= уже есть: ${name} (${slug})`,
      );
    }

    // Dance → EDM (только если EDM ещё нет — иначе конфликт slug).
    const renamed = await client.query(
      `UPDATE genres SET name = 'EDM', slug = 'edm', updated_at = now()
       WHERE slug = 'dance' AND deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM genres WHERE slug = 'edm' AND deleted_at IS NULL
         )`,
    );
    console.log(
      renamed.rowCount > 0
        ? "~ переименован: Dance → EDM"
        : "= переименование Dance→EDM не требуется (нет Dance или EDM уже существует)",
    );

    const { rows } = await client.query(
      `SELECT name, slug FROM genres WHERE deleted_at IS NULL ORDER BY name`,
    );
    console.log(`\nВсего жанров: ${rows.length}`);
    console.log(rows.map((r) => `  ${r.name} (${r.slug})`).join("\n"));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Ошибка сида жанров:", err);
  process.exit(1);
});
