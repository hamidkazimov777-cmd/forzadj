import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/repositories/prisma";
import { getJobQueue } from "@/server/jobs";
import { requirePermission } from "@/server/auth/core/session";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  void request;
  try {
    await requirePermission("users.manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const assets = await prisma.asset.findMany({
    where: { type: "ARTWORK", status: "READY", deletedAt: null },
    select: { id: true, storageKey: true },
  });

  const queue = getJobQueue();
  let done = 0;
  for (const asset of assets) {
    await queue.enqueue("artwork.optimize", { storageKey: asset.storageKey });
    done++;
  }

  return NextResponse.json({ processed: done });
}
