import "server-only";
import { firmAccess, rows } from "@/lib/access";
import type { Matter, Event, Task, Settings } from "./types";
export async function overview(firm: string) {
  const { client } = await firmAccess(firm);
  const [m, e, t, s] = await Promise.all([
    client
      .from("matters")
      .select("*")
      .eq("firm_id", firm)
      .order("created_at", { ascending: false })
      .returns<Matter[]>(),
    client
      .from("events")
      .select("*")
      .eq("firm_id", firm)
      .eq("status", "SCHEDULED")
      .order("starts_at")
      .returns<Event[]>(),
    client
      .from("tasks")
      .select("*")
      .eq("firm_id", firm)
      .eq("status", "OPEN")
      .order("due_on")
      .returns<Task[]>(),
    client
      .from("firm_settings")
      .select("*")
      .eq("firm_id", firm)
      .single<Settings>(),
  ]);
  const matters = rows(m),
    events = rows(e),
    tasks = rows(t),
    settings = rows(s);
  // Never derive an urgency from a silently truncated API response.
  if ([matters, events, tasks].some((list) => list.length >= 1000))
    throw new Error(
      "El piloto requiere paginación para este volumen de datos.",
    );
  const active = new Set(
    matters.filter((x) => x.status === "OPEN").map((x) => x.id),
  );
  return {
    matters,
    events: events.filter((x) => active.has(x.matter_id)),
    tasks: tasks.filter((x) => active.has(x.matter_id)),
    settings,
  };
}
