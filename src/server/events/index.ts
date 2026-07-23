/**
 * Внутренняя шина доменных событий (in-process, синхронная).
 * Точка расширения: при выносе обработки в отдельный worker подписчики
 * заменяются мостом в очередь — издатели не меняются.
 *
 * Карта DomainEvents пополняется по этапам
 * (Этап 2: asset.uploaded, track.published; Этап 4: version.downloaded ...).
 */

export interface DomainEvents {
  /** Демонстрационное событие; заменяется реальными на Этапе 2. */
  "system.started": { at: Date };
}

export type DomainEventName = keyof DomainEvents;

type Subscriber<K extends DomainEventName> = (
  payload: DomainEvents[K],
) => void | Promise<void>;

const subscribers = new Map<DomainEventName, Set<Subscriber<DomainEventName>>>();

export function onEvent<K extends DomainEventName>(
  name: K,
  subscriber: Subscriber<K>,
): () => void {
  const set = subscribers.get(name) ?? new Set();
  set.add(subscriber as Subscriber<DomainEventName>);
  subscribers.set(name, set);
  return () => set.delete(subscriber as Subscriber<DomainEventName>);
}

export async function emitEvent<K extends DomainEventName>(
  name: K,
  payload: DomainEvents[K],
): Promise<void> {
  const set = subscribers.get(name);
  if (!set) return;
  for (const subscriber of set) {
    try {
      await subscriber(payload);
    } catch (err) {
      // Ошибка подписчика не должна ронять доменную операцию издателя.
      console.error(`[events] subscriber of "${name}" failed:`, err);
    }
  }
}
