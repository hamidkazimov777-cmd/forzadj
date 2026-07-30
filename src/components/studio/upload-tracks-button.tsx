import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Единая точка входа в существующий экран загрузки Studio. */
export function UploadTracksButton({
  className,
}: {
  className?: string;
}) {
  return (
    <Button asChild className={className}>
      <Link href="/studio/tracks/upload">Загрузить треки</Link>
    </Button>
  );
}
