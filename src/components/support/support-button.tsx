"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Heart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./copy-button";
import { SupportForm } from "./support-form";
import {
  donationThankYou,
  domesticMethod,
  internationalMethod,
  fullSwiftText,
} from "@/lib/config/donation-details";
import type { SupportSubmitFn } from "@/types/donation";

/**
 * Кнопка «Поддержать ForzaDJ» + модальное окно поддержки. Реквизиты берутся
 * из централизованного конфига. Платёжных интеграций нет — только ручной
 * перевод и заявка. Mobile-first: карточки в колонку, на sm+ — в ряд.
 */
export function SupportButton({
  submit,
  variant = "default",
  className,
  label,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  submit: SupportSubmitFn;
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  /** Текст/иконка на кнопке-триггере. По умолчанию — полная подпись. */
  label?: React.ReactNode;
  /** Управление извне (например, донат-напоминанием). Без них — обычная кнопка. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Скрыть кнопку-триггер — диалог открывается только программно через `open`. */
  hideTrigger?: boolean;
}) {
  const [swiftOpen, setSwiftOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant={variant} className={className}>
            {label ?? (
              <>
                <Heart className="size-4 fill-current" />
                Поддержать ForzaDJ
              </>
            )}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{donationThankYou.title}</DialogTitle>
          <DialogDescription>{donationThankYou.text}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Россия */}
          <section className="rounded-xl border p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <span aria-hidden>{domesticMethod.flag}</span> {domesticMethod.title}
            </h3>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">{domesticMethod.bank} · Карта</p>
                <p className="font-mono text-base tracking-wide">{domesticMethod.card.number}</p>
                <CopyButton
                  value={domesticMethod.card.copyValue}
                  label="Скопировать номер карты"
                  className="mt-2 w-full sm:w-auto"
                />
              </div>
              <div className="border-t pt-3">
                <p className="text-muted-foreground">СБП</p>
                <p className="font-mono text-base">{domesticMethod.sbp.phone}</p>
                <CopyButton
                  value={domesticMethod.sbp.copyValue}
                  label="Скопировать номер телефона"
                  className="mt-2 w-full sm:w-auto"
                />
              </div>
            </div>
          </section>

          {/* Международный */}
          <section className="rounded-xl border p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <span aria-hidden>{internationalMethod.flag}</span> {internationalMethod.title}
            </h3>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">
                  {internationalMethod.bank} · {internationalMethod.system}
                </p>
                <p className="font-mono text-base tracking-wide">{internationalMethod.card.number}</p>
                <CopyButton
                  value={internationalMethod.card.copyValue}
                  label="Скопировать номер карты"
                  className="mt-2 w-full sm:w-auto"
                />
              </div>

              <div className="border-t pt-3">
                <button
                  type="button"
                  onClick={() => setSwiftOpen((v) => !v)}
                  className="flex w-full items-center justify-between text-sm font-medium hover:underline"
                  aria-expanded={swiftOpen}
                >
                  Показать SWIFT-реквизиты
                  <span aria-hidden className="text-muted-foreground">
                    {swiftOpen ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </span>
                </button>
                {swiftOpen && (
                  <div className="mt-3 space-y-2">
                    <dl className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
                      {internationalMethod.swift.map((f) => (
                        <div key={f.label}>
                          <dt className="text-xs text-muted-foreground">{f.label}</dt>
                          <dd className="whitespace-pre-line font-mono">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <CopyButton
                      value={fullSwiftText()}
                      label="Скопировать все реквизиты"
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Подтверждение перевода */}
          <div className="border-t pt-4">
            {!formOpen ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setFormOpen(true)}
              >
                <Check className="size-4" />
                Я уже поддержал проект
              </Button>
            ) : (
              <SupportForm submit={submit} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
