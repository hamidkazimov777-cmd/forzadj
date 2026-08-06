"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SUPPORT_CATEGORIES } from "@/lib/config/support-request";
import type { SupportTicketSubmitFn } from "@/types/support-request";

/**
 * Форма обращения в поддержку. Отправка через server action (FormData) с
 * клиентской валидацией (required/email) и серверной (zod в экшене).
 */
export function SupportRequestForm({
  submit,
  defaultName,
  defaultTelegram,
  onDone,
}: {
  submit: SupportTicketSubmitFn;
  defaultName?: string;
  defaultTelegram?: string;
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [agree, setAgree] = useState(false);

  function handleSubmit(formData: FormData) {
    if (!agree) {
      toast.error("Подтвердите согласие на обработку данных");
      return;
    }
    formData.set("consent", agree ? "on" : "");
    startTransition(async () => {
      const res = await submit(formData);
      if (res.ok) {
        setDone(true);
        toast.success("Обращение отправлено", {
          description: res.ticketId
            ? `Номер обращения: ${res.ticketId.slice(0, 8)}`
            : "Мы свяжемся с вами.",
        });
        formRef.current?.reset();
        onDone?.();
      } else {
        toast.error(res.error ?? "Не удалось отправить обращение");
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm">
        Обращение отправлено ✅ Мы свяжемся с вами по указанным контактам.
      </div>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sr-category">Категория *</Label>
        <select
          id="sr-category"
          name="category"
          required
          defaultValue="GENERAL"
          className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sr-name">Имя *</Label>
          <Input
            id="sr-name"
            name="name"
            required
            maxLength={120}
            defaultValue={defaultName}
            placeholder="Как к вам обращаться"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sr-email">Email *</Label>
          <Input
            id="sr-email"
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sr-telegram">Telegram (необязательно)</Label>
        <Input
          id="sr-telegram"
          name="telegram"
          maxLength={120}
          placeholder="@username"
          defaultValue={defaultTelegram}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sr-subject">Тема *</Label>
        <Input id="sr-subject" name="subject" required maxLength={200} placeholder="Коротко о сути" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sr-message">Сообщение *</Label>
        <Textarea
          id="sr-message"
          name="message"
          required
          maxLength={5000}
          placeholder="Опишите вопрос или проблему подробно"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sr-attachments">Вложения (необязательно)</Label>
        <Input
          id="sr-attachments"
          name="attachments"
          type="file"
          multiple
          accept="image/*,application/pdf,text/plain,application/zip"
          className="file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          До 5 файлов, каждый до 10 МБ (изображения, PDF, TXT, ZIP).
        </p>
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <Checkbox
          checked={agree}
          onCheckedChange={(v) => setAgree(v === true)}
          className="mt-0.5"
        />
        <span className="text-muted-foreground">
          Я подтверждаю указанные контактные данные и соглашаюсь на их обработку
          для рассмотрения обращения в соответствии с{" "}
          <Link href="/legal/privacy" className="underline" target="_blank">
            Политикой конфиденциальности
          </Link>
          .
        </span>
      </label>

      <Button type="submit" disabled={pending || !agree} className="mt-1">
        {pending ? "Отправка…" : "Отправить обращение"}
      </Button>
    </form>
  );
}
