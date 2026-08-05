"use client";

import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupportButton } from "./support-button";
import type { SupportSubmitFn } from "@/types/donation";

/**
 * Ненавязчивое напоминание о поддержке проекта. Показывается один раз за
 * визит, спустя время активности на сайте — и только тем, кто уже реально
 * пользуется сервисом (есть хотя бы одно скачивание). Cooldown и постоянный
 * отказ хранятся в localStorage — без похода на сервер и лишних таблиц.
 */

const STORAGE_KEY = "forzadj_donation_nudge";
const SHOW_AFTER_MS = 75_000;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

interface NudgeState {
  lastShownAt?: number;
  dismissedForever?: boolean;
}

function readState(): NudgeState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeState(patch: NudgeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readState(), ...patch }));
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — тихо игнорируем.
  }
}

export function DonationNudge({
  submit,
  hasDownloaded,
}: {
  submit: SupportSubmitFn;
  /** Показываем только тем, кто уже скачал хотя бы трек — реальный сигнал использования. */
  hasDownloaded: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!hasDownloaded) return;

    const state = readState();
    if (state.dismissedForever) return;
    if (state.lastShownAt && Date.now() - state.lastShownAt < COOLDOWN_MS) return;

    const timer = setTimeout(() => {
      setVisible(true);
      writeState({ lastShownAt: Date.now() });
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [hasDownloaded]);

  if (!visible) return null;

  return (
    <>
      <div
        role="complementary"
        aria-label="Напоминание о поддержке"
        className="fixed bottom-20 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-4 md:bottom-6 md:right-6"
      >
        <button
          type="button"
          aria-label="Закрыть"
          onClick={() => setVisible(false)}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex gap-3 pr-5">
          <Heart className="mt-0.5 size-5 shrink-0 fill-primary text-primary" />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium leading-snug">
              ForzaDJ держится на комьюнити
            </p>
            <p className="text-sm text-muted-foreground">
              Хостинг и новые треки — на плечах таких же диджеев, как вы.
              Если сайт пригодился — можно поддержать.
            </p>
            <div className="mt-1 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setDialogOpen(true);
                  setVisible(false);
                }}
              >
                Поддержать
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setVisible(false);
                  writeState({ dismissedForever: true });
                }}
              >
                Не показывать
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SupportButton
        submit={submit}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        hideTrigger
      />
    </>
  );
}
