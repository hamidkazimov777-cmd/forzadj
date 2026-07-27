"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/auth/providers/supabase-server";

export async function signOut(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
