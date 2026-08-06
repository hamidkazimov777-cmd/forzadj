"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SupportRequestForm } from "./support-request-form";
import type { SupportTicketSubmitFn } from "@/types/support-request";

/**
 * Кнопка «Support» + модальное окно с формой обращения. Отдельно от кнопки
 * «Поддержать ForzaDJ» (донаты) — это официальный канал связи с администрацией.
 */
export function SupportRequestButton({
  submit,
  defaultName,
  defaultTelegram,
  variant = "outline",
  className,
  label,
}: {
  submit: SupportTicketSubmitFn;
  defaultName?: string;
  defaultTelegram?: string;
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
              <LifeBuoy className="size-4" />
              Support
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Поддержка</DialogTitle>
          <DialogDescription>
            Официальный канал связи с администрацией. Опишите вопрос — мы ответим по
            указанным контактам. Обращения правообладателей принимаются только через
            эту форму.
          </DialogDescription>
        </DialogHeader>

        <SupportRequestForm
          submit={submit}
          defaultName={defaultName}
          defaultTelegram={defaultTelegram}
        />
      </DialogContent>
    </Dialog>
  );
}
