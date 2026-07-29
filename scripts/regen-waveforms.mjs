/**
 * Разовая переобработка волны: добавляет частотные полосы (bands) в peaks.json
 * существующих версий, чтобы «спектральная» волна работала на старых треках.
 *
 * Self-contained: читает БД (pg) и Supabase Storage напрямую, считает peaks и
 * энергию по 3 полосам через ffmpeg — тем же алгоритмом, что asset.process.
 * НЕ трогает БД (только перезаписывает peaks.json в бакете previews).
 *
 * Запуск на сервере:  cd /opt/forzadj && node scripts/regen-waveforms.mjs
 * Требует: ffmpeg в PATH, @supabase/supabase-js и pg в node_modules, .env рядом.
 */
import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const PEAKS_COUNT = 1000;
const BAND_SAMPLE_RATE = 22050;
const BANDS = [
  { name: "low", filter: "lowpass=f=250" },
  { name: "mid", filter: "highpass=f=250,lowpass=f=4000" },
  { name: "high", filter: "highpass=f=4000" },
];

const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
const pick = (k) => {
  // Учитываем кавычки и inline-комментарии: KEY="val"  # comment / KEY=val # c
  const m = raw.match(
    new RegExp(`^${k}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^#\\r\\n]*))`, "m"),
  );
  if (!m) return null;
  const v = (m[1] ?? m[2] ?? m[3] ?? "").trim();
  return v || null;
};
const dbUrl = pick("DIRECT_URL") ?? pick("DATABASE_URL");
const supaUrl = pick("NEXT_PUBLIC_SUPABASE_URL");
const supaKey = pick("SUPABASE_SERVICE_ROLE_KEY");
const BUCKET_AUDIO = pick("STORAGE_BUCKET_AUDIO") ?? "audio";
const BUCKET_PREVIEWS = pick("STORAGE_BUCKET_PREVIEWS") ?? "previews";
if (!dbUrl || !supaUrl || !supaKey) throw new Error("Не найдены DB/Supabase env");

const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    const out = [];
    const err = [];
    p.stdout.on("data", (c) => out.push(c));
    p.stderr.on("data", (c) => err.push(c));
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0
        ? resolve(Buffer.concat(out))
        : reject(new Error(`ffmpeg ${code}: ${Buffer.concat(err).toString().slice(-300)}`)),
    );
  });
}

function computePeaks(pcm) {
  const s = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  if (s.length === 0) return [];
  const bucket = Math.max(1, Math.floor(s.length / PEAKS_COUNT));
  const peaks = [];
  for (let i = 0; i < s.length; i += bucket) {
    let max = 0;
    const end = Math.min(i + bucket, s.length);
    for (let j = i; j < end; j++) if (Math.abs(s[j]) > max) max = Math.abs(s[j]);
    peaks.push(Math.round((max / 32768) * 1000) / 1000);
  }
  return peaks.slice(0, PEAKS_COUNT);
}

function computeBandRms(pcm, count) {
  const s = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const out = [];
  if (s.length === 0 || count === 0) return new Array(count).fill(0);
  const bucket = Math.max(1, Math.floor(s.length / count));
  for (let i = 0; i < s.length && out.length < count; i += bucket) {
    let sum = 0;
    const end = Math.min(i + bucket, s.length);
    for (let j = i; j < end; j++) {
      const v = s[j] / 32768;
      sum += v * v;
    }
    out.push(Math.sqrt(sum / Math.max(1, end - i)));
  }
  while (out.length < count) out.push(0);
  return out;
}

async function processOne(row, dir) {
  const src = join(dir, "src");
  const { data, error } = await supa.storage.from(BUCKET_AUDIO).download(row.storage_key);
  if (error || !data) throw new Error(`download: ${error?.message ?? "нет данных"}`);
  writeFileSync(src, Buffer.from(await data.arrayBuffer()));
  try {
    const pcm = await runFfmpeg([
      "-i", src, "-map", "a:0", "-vn", "-ac", "1", "-ar", "4000", "-f", "s16le", "pipe:1",
    ]);
    const peaks = computePeaks(pcm);
    const bandRaw = { low: [], mid: [], high: [] };
    for (const { name, filter } of BANDS) {
      const bandPcm = await runFfmpeg([
        "-i", src, "-map", "a:0", "-vn", "-af", filter,
        "-ac", "1", "-ar", String(BAND_SAMPLE_RATE), "-f", "s16le", "pipe:1",
      ]);
      bandRaw[name] = computeBandRms(bandPcm, peaks.length);
    }
    let gmax = 0;
    for (const n of ["low", "mid", "high"]) for (const v of bandRaw[n]) if (v > gmax) gmax = v;
    const norm = (a) => a.map((v) => (gmax > 0 ? Math.round((v / gmax) * 1000) / 1000 : 0));
    const json = Buffer.from(
      JSON.stringify({
        version: 2,
        count: peaks.length,
        durationSeconds: row.duration_seconds ?? null,
        peaks,
        bands: { low: norm(bandRaw.low), mid: norm(bandRaw.mid), high: norm(bandRaw.high) },
      }),
    );
    const key = `tracks/${row.track_id}/${row.vid}/peaks.json`;
    const up = await supa.storage
      .from(BUCKET_PREVIEWS)
      .upload(key, json, { contentType: "application/json", upsert: true });
    if (up.error) throw new Error(`upload: ${up.error.message}`);
  } finally {
    try {
      unlinkSync(src);
    } catch {}
  }
}

async function main() {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  const { rows } = await client.query(
    `SELECT a.storage_key, v.id vid, v.track_id, v.duration_seconds
       FROM assets a JOIN track_versions v ON v.id = a.version_id
      WHERE a.type = 'ORIGINAL' AND a.deleted_at IS NULL AND v.deleted_at IS NULL
      ORDER BY v.created_at`,
  );
  await client.end();
  const limit = Number(process.argv[2]) || rows.length;
  rows.length = Math.min(rows.length, limit);
  console.log(`Версий к переобработке: ${rows.length}`);
  const dir = mkdtempSync(join(tmpdir(), "forzadj-wf-"));
  let ok = 0;
  let fail = 0;
  for (const [i, row] of rows.entries()) {
    try {
      await processOne(row, dir);
      ok++;
      if ((i + 1) % 10 === 0 || i + 1 === rows.length)
        console.log(`  ${i + 1}/${rows.length} (ok=${ok}, fail=${fail})`);
    } catch (e) {
      fail++;
      console.warn(`  ✗ ${row.vid}: ${e.message}`);
    }
  }
  console.log(`Готово: ok=${ok}, fail=${fail}`);
}

main().catch((e) => {
  console.error("Ошибка переобработки волн:", e);
  process.exit(1);
});
