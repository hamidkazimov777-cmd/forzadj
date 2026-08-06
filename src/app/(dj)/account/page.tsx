import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupportButton } from "@/components/support/support-button";
import { SupportRequestButton } from "@/components/support-request/support-request-button";
import { requireUser } from "@/server/auth/core/session";
import { signOut } from "@/server/actions/auth.actions";
import { submitSupportRequestAction } from "@/server/actions/donation.actions";
import { submitSupportTicketAction } from "@/server/actions/support.actions";
import { donationThankYou } from "@/lib/config/donation-details";

export const metadata = { title: "Аккаунт" };

const ROLE_LABELS: Record<string, string> = {
  DJ: "DJ",
  UPLOADER: "Контент-менеджер",
  ADMIN: "Администратор",
  SUPER_ADMIN: "Владелец",
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
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Поддержать ForzaDJ</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{donationThankYou.text}</p>
          <div className="shrink-0">
            <SupportButton submit={submitSupportRequestAction} />
          </div>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Помощь и поддержка</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Вопрос, проблема или обращение правообладателя — напишите нам через
            официальную форму поддержки.
          </p>
          <div className="shrink-0">
            <SupportRequestButton
              submit={submitSupportTicketAction}
              defaultName={user.displayName}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
