export interface ToggleFavoriteResult {
  favorited: boolean;
}

export type ToggleFavoriteFn = (
  versionId: string,
) => Promise<ToggleFavoriteResult>;
