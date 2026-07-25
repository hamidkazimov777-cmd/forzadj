/** DTO смены роли — общий для Server Action и клиентского селектора. */
export interface RoleChangeResult {
  ok: boolean;
  error?: string;
}

export type ChangeRoleFn = (
  userId: string,
  role: "DJ" | "ADMIN",
) => Promise<RoleChangeResult>;
