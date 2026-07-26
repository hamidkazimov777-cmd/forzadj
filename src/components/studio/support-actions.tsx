"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Actions {
  approve: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
  getReceiptUrl: (id: string) => Promise<{ url: string } | { error: string }>;
}

/**
 * Действия владельца над заявкой поддержки: подтвердить (→ COMPLETED),
 * отклонить (→ CANCELLED), открыть чек (signed URL). Решение — ручное.
 */
export function SupportActions({
  donationId,
  status,
  hasReceipt,
  actions,
}: {
  donationId: string;
  status: string;
  hasReceipt: boolean;
  actions: Actions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isPending = status === "PENDING";

  function openReceipt() {
    startTransition(async () => {
      const res = await actions.getReceiptUrl(donationId);
      if ("url" in res) window.open(res.url, "_blank", "noopener");
      else toast.error(res.error);
    });
  }

  function decide(kind: "approve" | "reject") {
    startTransition(async () => {
      await actions[kind](donationId);
      toast.success(kind === "approve" ? "Заявка подтверждена" : "Заявка отклонена");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasReceipt && (
        <Button size="sm" variant="outline" disabled={pending} onClick={openReceipt}>
          Чек
        </Button>
      )}
      {isPending && (
        <>
          <Button size="sm" disabled={pending} onClick={() => decide("approve")}>
            ✅ Подтвердить
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => decide("reject")}
          >
            ❌ Отклонить
          </Button>
        </>
      )}
    </div>
  );
}
