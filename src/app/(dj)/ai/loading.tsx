import { Sparkles } from "lucide-react";

/**
 * Состояние ожидания во время генерации сета (GigaChat, 2 прохода —
 * несколько секунд). Показывается при навигации на /ai?q=...
 */
export default function AiLoading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 py-24 text-center">
      <Sparkles className="size-8 animate-pulse text-primary" />
      <p className="text-sm font-medium">Собираем сет под ваш запрос…</p>
      <p className="text-xs text-muted-foreground">
        ИИ подбирает жанры, темп и выстраивает порядок сведения.
      </p>
    </div>
  );
}
