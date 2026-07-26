import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SupportActions } from "@/components/studio/support-actions";
import { requireStudioPermission } from "@/server/auth/core/session";
import { donationRepository } from "@/server/repositories/donation.repository";
import {
  approveDonationAction,
  rejectDonationAction,
  getReceiptUrlAction,
} from "@/server/actions/donation.actions";

export const metadata = { title: "Поддержка проекта" };

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  CREATED: { label: "создана", variant: "outline" },
  PENDING: { label: "ожидает", variant: "secondary" },
  COMPLETED: { label: "подтверждена", variant: "default" },
  FAILED: { label: "ошибка", variant: "destructive" },
  CANCELLED: { label: "отклонена", variant: "destructive" },
  REFUNDED: { label: "возврат", variant: "outline" },
};

function fmtAmount(minor: number, currency: string): string {
  return `${(minor / 100).toLocaleString("ru-RU")} ${currency}`;
}

export default async function StudioSupportPage() {
  // Только владелец (donations.manage). Иначе 404 (скрываем существование).
  await requireStudioPermission("donations.manage");

  const [total, donations] = await donationRepository.listAll({
    provider: "MANUAL",
    take: 200,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        Поддержка проекта{" "}
        <span className="text-base font-normal text-muted-foreground">({total})</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Журнал заявок о ручных переводах. Решение принимается вручную после
        сверки банковского перевода — это не влияет на аккаунт пользователя.
      </p>

      <div className="mt-4 overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя / ник</TableHead>
              <TableHead>Пользователь</TableHead>
              <TableHead>Сумма</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Комментарий</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {donations.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Заявок пока нет.
                </TableCell>
              </TableRow>
            )}
            {donations.map((d) => {
              const meta = (d.metadata ?? {}) as {
                donorName?: string;
                comment?: string;
                receiptKey?: string;
              };
              return (
                <TableRow key={d.id}>
                  <TableCell>{meta.donorName || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.user.displayName}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmtAmount(d.amountMinor, d.currency)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {d.createdAt.toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate" title={meta.comment}>
                    {meta.comment || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[d.status].variant}>
                      {STATUS_BADGE[d.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SupportActions
                      donationId={d.id}
                      status={d.status}
                      hasReceipt={Boolean(meta.receiptKey)}
                      actions={{
                        approve: approveDonationAction,
                        reject: rejectDonationAction,
                        getReceiptUrl: getReceiptUrlAction,
                      }}
                    />
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
