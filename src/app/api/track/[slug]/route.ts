import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/core/session";
import { catalogRepository } from "@/server/repositories/catalog.repository";

/**
 * Детали трека (карточка + похожие) для клиентской смены трека на странице
 * без перезагрузки — так волна не перемонтируется и анимируется. Отдаёт те же
 * DTO, что и серверная страница трека.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const track = await catalogRepository.findBySlug(slug);
  if (!track) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const related = await catalogRepository.findRelated(track);
  return NextResponse.json({ track, related });
}
