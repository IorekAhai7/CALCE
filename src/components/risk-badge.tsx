import { deriveMatterRisk } from "@/modules/matters/domain/risk";
import { dayDistance, localDay } from "@/modules/cases/dates";
import type { Event, Task, Settings } from "@/modules/cases/types";
export function RiskBadge({
  events,
  tasks,
  settings,
}: {
  events: Event[];
  tasks: Task[];
  settings: Settings;
}) {
  const today = localDay(new Date(), settings.timezone);
  const days = [
    ...events
      .filter((e) => e.status === "SCHEDULED")
      .map((e) => dayDistance(localDay(e.starts_at, settings.timezone), today)),
    ...tasks
      .filter((t) => t.status === "OPEN")
      .map((t) => dayDistance(t.due_on, today)),
  ];
  const risk = deriveMatterRisk(days, {
    criticalDays: settings.critical_days,
    warningDays: settings.warning_days,
  });
  const label = {
    RED: "Atención próxima o vencida",
    YELLOW: "Por preparar",
    GREEN: "Con tiempo",
    NEUTRAL: "Sin pendientes",
  }[risk];
  return <span className={`badge risk-${risk.toLowerCase()}`}>{label}</span>;
}
