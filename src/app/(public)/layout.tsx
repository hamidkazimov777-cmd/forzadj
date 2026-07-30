import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

/**
 * Публичная зона: лендинг, тарифы, логин, публичные чарты.
 * Доступна без авторизации.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Link href="/" aria-label="ForzaDJ">
            <Wordmark className="h-5" />
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} ForzaDJ</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
              Политика конфиденциальности
            </Link>
            <Link href="/legal/terms" className="transition-colors hover:text-foreground">
              Пользовательское соглашение
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
