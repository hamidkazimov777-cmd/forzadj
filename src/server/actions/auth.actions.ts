"use server";

import { redirect } from "next/navigation";
import { clearSession } from "@/server/auth/core/session-cookie";

export async function signOut(): Promise<never> {
  await clearSession();
  redirect("/");
}
