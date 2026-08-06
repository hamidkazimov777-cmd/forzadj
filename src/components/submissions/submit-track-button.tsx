"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SubmitTrackForm } from "./submit-track-form";
import type { SubmissionSubmitFn } from "@/types/submission";

/**
 * Кнопка «Опубликовать свой трек» + модальное окно с формой заявки.
 */
export function SubmitTrackButton({
  submit,
  defaultAuthor,
  variant = "default",
  className,
  label,
}: {
  submit: SubmissionSubmitFn;
  defaultAuthor?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  label?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          {label ?? (
            <>
              <UploadCloud className="size-4" />
              Опубликовать свою работу
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Опубликовать свою работу</DialogTitle>
          <DialogDescription>
            Загрузите MP3 и заполните информацию. Трек пройдёт модерацию — о решении
            мы сообщим в Telegram.
          </DialogDescription>
        </DialogHeader>

        <SubmitTrackForm submit={submit} defaultAuthor={defaultAuthor} />
      </DialogContent>
    </Dialog>
  );
}
