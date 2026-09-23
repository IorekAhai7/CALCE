import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "./supabase/server";
import type { Settings } from "@/modules/cases/types";

export async function session() {
  const client = await db();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { client, user: data.user };
}
export async function firmAccess(firmId: string) {
  if (!z.uuid().safeParse(firmId).success) notFound();
  const { client, user } = await session();
  const { data, error } = await client
    .from("firms")
    .select("id,name")
    .eq("id", firmId)
    .maybeSingle();
  if (error)
    throw new Error("No fue posible consultar el despacho. Intenta de nuevo.");
  if (!data) notFound();
  const membership = await client
    .from("firm_memberships")
    .select("id,role")
    .eq("firm_id", firmId)
    .eq("profile_id", user.id)
    .eq("status", "ACTIVE")
    .single();
  if (membership.error) notFound();
  return {
    client,
    user,
    firm: data as { id: string; name: string },
    member: membership.data as { id: string; role: string },
  };
}
export async function firmSettings(firmId: string) {
  const { client } = await firmAccess(firmId);
  const { data, error } = await client
    .from("firm_settings")
    .select("*")
    .eq("firm_id", firmId)
    .single<Settings>();
  if (error) throw new Error("No fue posible consultar la configuración.");
  return data;
}
export function rows<T>({
  data,
  error,
}: {
  data: T | null;
  error: unknown;
}): T {
  if (error || data === null)
    throw new Error("No fue posible consultar los datos. Intenta de nuevo.");
  return data;
}
