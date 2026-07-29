/**
 * Разовый бэкфилл обложек: извлекает embedded artwork (ID3) из оригиналов
 * существующих версий и сохраняет как ARTWORK-ассет (тот же механизм, что и
 * новая загрузка). Идемпотентно — пропускает версии, у которых обложка уже есть.
 *
 * Запуск на сервере:  cd /opt/forzadj && node scripts/backfill-artwork.mjs [limit]
 * Требует: @supabase/supabase-js, pg, music-metadata в node_modules, .env рядом.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { parseBuffer } from "music-metadata";

const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
const pick = (k) => {
  const m = raw.match(
    new RegExp(`^${k}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^#\\r\\n]*))`, "m"),
  );
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? "").trim() || null;
};
const dbUrl = pick("DIRECT_URL") ?? pick("DATABASE_URL");
const supaUrl = pick("NEXT_PUBLIC_SUPABASE_URL");
const supaKey = pick("SUPABASE_SERVICE_ROLE_KEY");
const BUCKET_AUDIO = pick("STORAGE_BUCKET_AUDIO") ?? "audio";
const BUCKET_ARTWORK = pick("STORAGE_BUCKET_ARTWORK") ?? "artwork";
if (!dbUrl || !supaUrl || !supaKey) throw new Error("Нет DB/Supabase env");

const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

async function processOne(client, row) {
  const { data, error } = await supa.storage
    .from(BUCKET_AUDIO)
    .download(row.storage_key);
  if (error || !data) throw new Error(`download: ${error?.message ?? "нет данных"}`);
  const buf = Buffer.from(await data.arrayBuffer());

  let meta;
  try {
    meta = await parseBuffer(buf, { mimeType: row.mime ?? undefined });
  } catch (e) {
    return "skip"; // не распарсилось — пропуск
  }
  const pic = meta.common.picture?.[0];
  if (!pic?.data || pic.data.length === 0) return "skip"; // нет обложки

  const fmt = (pic.format ?? "").toLowerCase();
  const isPng = fmt.includes("png");
  const ext = isPng ? "png" : "jpg";
  const mime = isPng ? "image/png" : "image/jpeg";
  const key = `tracks/${row.track_id}/${row.vid}/cover.${ext}`;
  const artBuf = Buffer.from(pic.data);

  const up = await supa.storage
    .from(BUCKET_ARTWORK)
    .upload(key, artBuf, { contentType: mime, upsert: true });
  if (up.error) throw new Error(`upload: ${up.error.message}`);

  await client.query(
    `INSERT INTO assets (id, version_id, type, status, storage_key, mime, size_bytes, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'ARTWORK', 'READY', $2, $3, $4, now(), now())`,
    [row.vid, key, mime, artBuf.length],
  );
  return "ok";
}

async function main() {
  const limit = Number(process.argv[2]) || null;
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try {
    const { rows } = await c.query(
      `SELECT a.storage_key, a.mime, v.id vid, v.track_id
         FROM assets a
         JOIN track_versions v ON v.id = a.version_id
        WHERE a.type = 'ORIGINAL' AND a.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM assets a2
            WHERE a2.version_id = v.id AND a2.type = 'ARTWORK' AND a2.deleted_at IS NULL
          )
        ORDER BY v.created_at
        ${limit ? `LIMIT ${limit}` : ""}`,
    );
    console.log(`Версий без обложки: ${rows.length}`);
    let ok = 0, skip = 0, fail = 0;
    for (const [i, row] of rows.entries()) {
      try {
        const r = await processOne(c, row);
        if (r === "ok") ok++;
        else skip++;
      } catch (e) {
        fail++;
        console.warn(`  ✗ ${row.vid}: ${e.message}`);
      }
      if ((i + 1) % 20 === 0 || i + 1 === rows.length)
        console.log(`  ${i + 1}/${rows.length} (ok=${ok}, skip=${skip}, fail=${fail})`);
    }
    console.log(`Готово: обложек добавлено=${ok}, без обложки=${skip}, ошибок=${fail}`);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("Ошибка бэкфилла обложек:", e);
  process.exit(1);
});
