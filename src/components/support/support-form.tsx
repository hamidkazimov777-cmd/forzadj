"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { donationCurrencies } from "@/lib/config/donation-details";
import type { SupportSubmitFn } from "@/types/donation";

/**
 * Форма подтверждения перевода. Появляется по кнопке «Я уже поддержал».
 * Все поля кроме суммы — необязательны; чек необязателен.
 */
export function SupportForm({ submit }: { submit: SupportSubmitFn }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await submit(formData);
      if (res.ok) {
        setDone(true);
        toast.success("Заявка отправлена", {
          description: "Спасибо! Мы сверим перевод вручную.",
        });
        formRef.current?.reset();
      } else {
        toast.error(res.error ?? "Не удалось отправить заявку");
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm">
        Заявка отправлена ❤️ Спасибо за поддержку! Владелец сверит перевод
        вручную — это не влияет на ваш аккаунт.
      </div>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="donorName">Имя или ник (необязательно)</Label>
        <Input id="donorName" name="donorName" maxLength={80} placeholder="Как вас упомянуть" />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Сумма перевода *</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min="1"
            step="any"
            required
            placeholder="500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Валюта</Label>
          <select
            id="currency"
            name="currency"
            defaultValue="RUB"
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            {donationCurrencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comment">Комментарий (необязательно)</Label>
        <Input id="comment" name="comment" maxLength={500} placeholder="Пара слов" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="receipt">Чек (необязательно)</Label>
        <Input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/*,application/pdf"
          className="file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Изображение или PDF, до 8 МБ. Наличие чека необязательно.
        </p>
      </div>

      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Отправка…" : "Отправить"}
      </Button>
    </form>
  );
}
