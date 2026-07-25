import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserRoleSelect } from "@/components/studio/user-role-select";
import { requireStudioPermission } from "@/server/auth/core/session";
import { userRepository } from "@/server/repositories/user.repository";
import { changeUserRoleAction } from "@/server/actions/user.actions";

export const metadata = { title: "Пользователи" };

const ROLE_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  SUPER_ADMIN: "default",
  ADMIN: "secondary",
  DJ: "outline",
  UPLOADER: "outline",
};

export default async function StudioUsersPage() {
  // Управление пользователями — только владелец (users.manage). Иначе 404.
  const actor = await requireStudioPermission("users.manage");
  const users = await userRepository.listUsers({ take: 200 });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        Пользователи{" "}
        <span className="text-base font-normal text-muted-foreground">
          ({users.length})
        </span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Назначение роли ADMIN. Роль владельца (SUPER_ADMIN) неизменна и задаётся
        через настройки проекта.
      </p>

      <div className="mt-4 overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Пользователь</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead>Последний вход</TableHead>
              <TableHead>Роль</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const tg = u.identities[0];
              const username =
                tg?.profile && typeof tg.profile === "object"
                  ? (tg.profile as { username?: string | null }).username
                  : null;
              const protectedRow = u.role === "SUPER_ADMIN" || u.id === actor.id;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.displayName}
                    {u.id === actor.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(вы)</span>
                    )}
                    {u.bannedAt && (
                      <Badge variant="destructive" className="ml-2">бан</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {username ? `@${username}` : "—"}
                    {tg?.providerUserId && (
                      <span className="ml-2 text-xs">id {tg.providerUserId}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.lastLoginAt
                      ? u.lastLoginAt.toLocaleString("ru-RU")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={ROLE_BADGE[u.role] ?? "outline"}>
                        {u.role}
                      </Badge>
                      <UserRoleSelect
                        userId={u.id}
                        currentRole={u.role}
                        disabled={protectedRow}
                        changeRole={changeUserRoleAction}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
