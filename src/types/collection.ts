/** Сводка крейта для списков и меню «в крейт». */
export interface CrateSummary {
  id: string;
  title: string;
  itemCount: number;
}

export interface CrateMutationResult {
  ok: boolean;
  error?: string;
}

/** Набор action-функций крейтов, прокидываемых в клиентские компоненты. */
export interface CrateActionFns {
  createCrate: (title: string) => Promise<{ id: string; title: string }>;
  addToCrate: (crateId: string, versionId: string) => Promise<CrateMutationResult>;
}
