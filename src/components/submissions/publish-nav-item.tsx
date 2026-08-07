"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubmitTrackForm } from "./submit-track-form";
import { cn } from "@/lib/utils";
import type { SubmissionSubmitFn } from "@/types/submission";

/**
 * Пункт бокового меню «Опубликовать работу» — открывает ту же модалку заявки,
 * что и кнопка в личном кабинете. Стилизован как обычная строка навигации.
 * Server Action передаётся пропсом (клиентские слои не импортируют server/).
 */
export function PublishNavItem({
  submit,
  onNavigate,
  large = false,
}: {
  submit: SubmissionSubmitFn;
  onNavigate?: () => void;
  /** Крупная touch-friendly строка для мобильного блока «Моё». */
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onNavigate?.();
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground",
          large &&
            "min-h-12 gap-3.5 rounded-lg px-3.5 py-3 text-[15px] [&_svg]:size-5",
        )}
      >
        <UploadCloud className="size-[18px] shrink-0" />
        Опубликовать работу
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Опубликовать свою работу</DialogTitle>
            <DialogDescription>
              Загрузите MP3 и заполните информацию. Работа пройдёт модерацию — о
              решении мы сообщим в Telegram.
            </DialogDescription>
          </DialogHeader>
          <SubmitTrackForm submit={submit} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
