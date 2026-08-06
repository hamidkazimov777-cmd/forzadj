"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { UploadCloud, FileAudio, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  SUBMISSION_WORK_TYPES,
  SUBMISSION_AUDIO_ACCEPT,
  SUBMISSION_AUDIO_MAX_BYTES,
  SUBMISSION_AUDIO_MIME,
} from "@/lib/config/submission";
import type { SubmissionSubmitFn } from "@/types/submission";

function isMp3(file: File): boolean {
  return SUBMISSION_AUDIO_MIME.has(file.type) || /\.mp3$/i.test(file.name);
}

/**
 * Форма отправки собственного трека на модерацию. Drag&Drop + выбор файла (MP3),
 * метаданные, обязательное соглашение (2 чекбокса). Отправка через server action.
 */
export function SubmitTrackForm({
  submit,
  defaultAuthor,
  onDone,
}: {
  submit: SubmissionSubmitFn;
  defaultAuthor?: string;
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeExclusive, setAgreeExclusive] = useState(false);

  function acceptFile(f: File | undefined | null) {
    if (!f) return;
    if (!isMp3(f)) {
      toast.error("Только MP3");
      return;
    }
    if (f.size > SUBMISSION_AUDIO_MAX_BYTES) {
      toast.error("Файл больше 100 МБ");
      return;
    }
    // Синхронизируем нативный input, чтобы файл попал в FormData.
    const dt = new DataTransfer();
    dt.items.add(f);
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    setFile(f);
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(formData: FormData) {
    if (!file) {
      toast.error("Прикрепите MP3-файл");
      return;
    }
    formData.set("agreeTerms", agreeTerms ? "on" : "");
    formData.set("agreeExclusive", agreeExclusive ? "on" : "");
    startTransition(async () => {
      const res = await submit(formData);
      if (res.ok) {
        setDone(true);
        toast.success("Заявка отправлена на модерацию", {
          description: "Статус появится в истории ниже.",
        });
        formRef.current?.reset();
        clearFile();
        onDone?.();
      } else {
        toast.error(res.error ?? "Не удалось отправить заявку");
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm">
        Заявка отправлена на модерацию ✅ Мы проверим трек и сообщим о решении в
        Telegram. Статус — в разделе «Мои заявки».
      </div>
    );
  }

  const canSubmit = !!file && agreeTerms && agreeExclusive && !pending;

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
      {/* Drop-зона MP3 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          acceptFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors",
          dragging ? "border-ring bg-accent/50" : "border-input hover:bg-accent/30",
        )}
      >
        {file ? (
          <div className="flex w-full items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <FileAudio className="size-4 shrink-0 text-primary" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} МБ
              </span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
              aria-label="Убрать файл"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <UploadCloud className="size-6 text-muted-foreground" />
            <p className="text-sm">
              Перетащите MP3 сюда или <span className="text-primary">выберите файл</span>
            </p>
            <p className="text-xs text-muted-foreground">Только MP3, до 100 МБ</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          name="audio"
          accept={SUBMISSION_AUDIO_ACCEPT}
          className="hidden"
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-title">Название *</Label>
          <Input id="st-title" name="title" required maxLength={200} placeholder="Название трека" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-artist">Артист *</Label>
          <Input id="st-artist" name="artist" required maxLength={200} placeholder="Исполнитель" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-workType">Тип работы *</Label>
          <select
            id="st-workType"
            name="workType"
            required
            defaultValue="REMIX"
            className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {SUBMISSION_WORK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-versionLabel">Версия</Label>
          <Input
            id="st-versionLabel"
            name="versionLabel"
            maxLength={120}
            placeholder="Extended Mix, VIP…"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-genre">Жанр</Label>
          <Input id="st-genre" name="genre" maxLength={80} placeholder="House" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-bpm">BPM</Label>
          <Input id="st-bpm" name="bpm" type="number" min={40} max={300} placeholder="126" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-key">Key</Label>
          <Input id="st-key" name="key" maxLength={16} placeholder="8A / Am" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="st-description">Описание</Label>
        <Textarea id="st-description" name="description" maxLength={2000} placeholder="Пара слов о работе" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-author">Автор</Label>
          <Input id="st-author" name="author" maxLength={200} defaultValue={defaultAuthor} placeholder="Кто сделал работу" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-contacts">Контакты</Label>
          <Input id="st-contacts" name="contacts" maxLength={500} placeholder="Email / Telegram" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="st-socials">Ссылки на соцсети</Label>
        <Textarea
          id="st-socials"
          name="socials"
          maxLength={1000}
          placeholder="По одной ссылке на строку"
        />
      </div>

      {/* Соглашение */}
      <div className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
        <p className="font-medium">Пользовательское соглашение</p>
        <p className="text-muted-foreground">
          Отправляя трек, вы подтверждаете, что обладаете необходимыми правами на
          материал. Все работы проходят обязательную модерацию; администрация
          вправе отказать в публикации, отредактировать карточку трека (название,
          описание, теги и другие метаданные) перед публикацией, а также удалить
          опубликованный материал. Запрещены нарушение авторских прав и отправка
          запрещённого контента.
        </p>
        <label className="flex items-start gap-2.5">
          <Checkbox
            checked={agreeTerms}
            onCheckedChange={(v) => setAgreeTerms(v === true)}
            className="mt-0.5"
          />
          <span>
            Я подтверждаю наличие прав на материал и принимаю условия модерации,
            редактирования и возможного отказа/удаления.
          </span>
        </label>
        <label className="flex items-start gap-2.5">
          <Checkbox
            checked={agreeExclusive}
            onCheckedChange={(v) => setAgreeExclusive(v === true)}
            className="mt-0.5"
          />
          <span>
            Обязуюсь не публиковать этот материал на других DJ Pool, аналогичных
            сервисах и площадках в течение <b>15 календарных дней</b> с момента
            отправки, пока идёт рассмотрение.
          </span>
        </label>
      </div>

      <Button type="submit" disabled={!canSubmit} className="mt-1">
        {pending ? "Отправка…" : "Отправить на модерацию"}
      </Button>
    </form>
  );
}
