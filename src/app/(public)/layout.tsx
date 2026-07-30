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
            <Wordmark className="text-xl" />
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} ForzaDJ
        </div>
      </footer>
    </div>
  );
}
