import { config } from "dotenv";
config({ path: "/Users/hamidkazimov/forzadjbeta/.env" });
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? "" });
  const prisma = new PrismaClient({ adapter });

  const track = await prisma.track.findFirst({
    where: { id: "019fce8f-5e62-727b-b93e-005140c2de1a", deletedAt: null },
    include: {
      artists: { include: { artist: true } },
      genres: { include: { genre: true } },
      versions: {
        where: { deletedAt: null },
        include: { assets: { where: { deletedAt: null } } },
      },
    },
  });

  if (!track) { console.log("TRACK NOT FOUND"); return; }
  
  console.log(`Title:   ${track.title}`);
  console.log(`Status:  ${track.status}`);
  console.log(`Year:    ${track.year}`);
  console.log(`Mood:    ${track.mood}`);
  console.log(`Artists: ${track.artists.map((a) => a.artist.name).join(", ") || "none"}`);
  console.log(`Genres:  ${track.genres.map((g) => g.genre.name).join(", ") || "none"}`);
  
  for (const v of track.versions) {
    console.log(`\nVersion: ${v.type} / analysisStatus=${v.analysisStatus} / BPM=${v.bpm}`);
    for (const a of v.assets) {
      console.log(`  ASSET ${a.type}: ${a.status} | originalName="${a.originalName}" | ${a.sizeBytes} bytes`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
