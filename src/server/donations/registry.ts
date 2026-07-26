import type { DonationProvider } from "@/types/db";
import type { DonationProviderAdapter } from "./donation-provider.interface";

/**
 * Реестр провайдеров донатов. В будущем сюда регистрируются адаптеры
 * (registerDonationProvider) — по одному на способ оплаты. DonationService
 * получает адаптер через getDonationProvider и не знает о конкретных SDK.
 *
 * На MVP реестр пуст: платёжных адаптеров ещё нет.
 */
const adapters = new Map<DonationProvider, DonationProviderAdapter>();

export function registerDonationProvider(adapter: DonationProviderAdapter): void {
  adapters.set(adapter.provider, adapter);
}

export function getDonationProvider(
  provider: DonationProvider,
): DonationProviderAdapter {
  const adapter = adapters.get(provider);
  if (!adapter) {
    throw new Error(
      `Провайдер донатов "${provider}" ещё не подключён (нет адаптера).`,
    );
  }
  return adapter;
}

export function isDonationProviderAvailable(provider: DonationProvider): boolean {
  return adapters.has(provider);
}
