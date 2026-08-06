import { Badge } from "@/components/ui/badge";
import { SUBMISSION_STATUS_LABELS } from "@/lib/config/submission";
import type { SubmissionRow } from "@/types/submission";
import type { SubmissionStatus } from "@/types/db";

const TONE_VARIANT: Record<
  "pending" | "success" | "danger",
  "secondary" | "default" | "destructive"
> = {
  pending: "secondary",
  success: "default",
  danger: "destructive",
};

/**
 * История отправленных заявок пользователя со статусами
 * (На модерации / Опубликован / Отклонён).
 */
export function SubmissionsHistory({ items }: { items: SubmissionRow[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
        Вы ещё не отправляли треки на публикацию.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {items.map((s) => {
        const meta = SUBMISSION_STATUS_LABELS[s.status as SubmissionStatus] ?? {
          label: s.status,
          tone: "pending" as const,
        };
        return (
          <li key={s.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {s.artist} — {s.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.workType}
                {" · "}
                {new Date(s.createdAt).toLocaleDateString("ru-RU")}
              </p>
              {s.status === "REJECTED" && s.rejectReason && (
                <p className="mt-0.5 text-xs text-destructive">Причина: {s.rejectReason}</p>
              )}
            </div>
            <Badge variant={TONE_VARIANT[meta.tone]} className="shrink-0 self-start sm:self-auto">
              {meta.label}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
