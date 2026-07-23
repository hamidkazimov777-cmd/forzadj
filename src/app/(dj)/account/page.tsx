import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/core/session";
import { signOut } from "@/server/actions/auth.actions";

export const metadata = { title: "Аккаунт" };

const ROLE_LABELS: Record<string, string> = {
  DJ: "DJ",
  UPLOADER: "Контент-менеджер",
  ADMIN: "Администратор",
};

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Аккаунт</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={user.avatarUrl ?? undefined} />
            <AvatarFallback>
              {user.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{user.displayName}</p>
            <Badge variant="secondary" className="mt-1">
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
          <form action={signOut}>
            <Button variant="outline" type="submit">
              Выйти
            </Button>
          </form>
        </CardContent>
      </Card>
      {/* Подписка и лимиты — Этап 4/6 */}
    </div>
  );
}
