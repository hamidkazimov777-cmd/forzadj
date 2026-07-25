"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ChangeRoleFn } from "@/types/user";

/**
 * Переключатель роли пользователя (DJ ↔ ADMIN) в Studio.
 * SUPER_ADMIN и текущий пользователь не редактируются (disabled) —
 * сервер это тоже проверяет (защита не только в UI).
 */
export function UserRoleSelect({
  userId,
  currentRole,
  disabled,
  changeRole,
}: {
  userId: string;
  currentRole: string;
  disabled: boolean;
  changeRole: ChangeRoleFn;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (disabled) {
    return (
      <span className="text-sm text-muted-foreground">
        {currentRole === "SUPER_ADMIN" ? "Владелец" : currentRole}
      </span>
    );
  }

  return (
    <select
      defaultValue={currentRole === "ADMIN" ? "ADMIN" : "DJ"}
      disabled={pending}
      className="h-9 rounded-md border bg-transparent px-2 text-sm"
      onChange={(e) => {
        const role = e.target.value as "DJ" | "ADMIN";
        startTransition(async () => {
          const res = await changeRole(userId, role);
          if (res.ok) {
            toast.success("Роль обновлена");
            router.refresh();
          } else {
            toast.error(res.error ?? "Не удалось изменить роль");
            router.refresh();
          }
        });
      }}
    >
      <option value="DJ">DJ</option>
      <option value="ADMIN">ADMIN</option>
    </select>
  );
}
