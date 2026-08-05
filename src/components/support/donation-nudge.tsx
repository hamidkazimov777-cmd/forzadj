"use client";

import { useEffect, useState } from "react";
import { HeartPulse, Zap, Headphones, ServerCog, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SupportButton } from "./support-button";
import type { SupportSubmitFn } from "@/types/donation";

/**
 * Напоминание о поддержке проекта. Показывается один раз за визит, спустя
 * время активности на сайте — и только тем, кто уже реально пользуется
 * сервисом (есть хотя бы одно скачивание). Cooldown и постоянный отказ
 * хранятся в localStorage — без похода на сервер и лишних таблиц.
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
  // Отдельно от hasDownloaded: ловит скачивание, случившееся уже после
  // рендера страницы (сервер узнает об этом только на следующей загрузке).
  const [downloadedThisSession, setDownloadedThisSession] = useState(false);

  useEffect(() => {
    const handler = () => setDownloadedThisSession(true);
    window.addEventListener("forzadj:download", handler);
    return () => window.removeEventListener("forzadj:download", handler);
  }, []);

  useEffect(() => {
    if (!hasDownloaded && !downloadedThisSession) return;

    const state = readState();
    if (state.dismissedForever) return;
    if (state.lastShownAt && Date.now() - state.lastShownAt < COOLDOWN_MS) return;

    const timer = setTimeout(() => {
      setVisible(true);
      writeState({ lastShownAt: Date.now() });
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [hasDownloaded, downloadedThisSession]);

  function dismiss(forever: boolean) {
    setVisible(false);
    if (forever) writeState({ dismissedForever: true });
  }

  return (
    <>
      <Dialog open={visible} onOpenChange={(open) => !open && dismiss(false)}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex flex-col items-center gap-6 py-2 text-center">
            <HeartPulse className="size-16 text-primary" strokeWidth={1.5} />

            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold leading-tight">
                ForzaDJ существует
              </h2>
              <h2 className="bg-gradient-to-r from-primary to-teal-400 bg-clip-text text-2xl font-semibold leading-tight text-transparent">
                благодаря своему сообществу
              </h2>
            </div>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                Мы постоянно работаем над новыми функциями, каталогом и
                скоростью платформы.
              </p>
              <p>
                Если сервис стал частью твоей работы — поддержка поможет
                развивать его ещё быстрее.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Zap className="size-5" />
                </div>
                <span className="text-xs text-muted-foreground">
                  Новые функции
                  <br />и возможности
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex size-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500">
                  <Headphones className="size-5" />
                </div>
                <span className="text-xs text-muted-foreground">
                  Пополнение
                  <br />
                  каталога
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <ServerCog className="size-5" />
                </div>
                <span className="text-xs text-muted-foreground">
                  Скорость и
                  <br />
                  стабильность
                </span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2">
              <Button
                className="w-full bg-gradient-to-r from-primary to-teal-400 text-primary-foreground hover:opacity-90"
                onClick={() => {
                  setDialogOpen(true);
                  setVisible(false);
                }}
              >
                Поддержать развитие →
              </Button>
              <Button variant="outline" onClick={() => dismiss(false)}>
                Не сейчас
              </Button>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" />
              Поддержка добровольная. Спасибо, что ты с нами! 🙏
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <SupportButton
        submit={submit}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        hideTrigger
      />
    </>
  );
}
