// Day distances use firm-calendar dates, never a division of elapsed local hours.
export function localDay(value: string | Date, zone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function dayDistance(day: string, today: string) {
  return Math.round(
    (Date.parse(day + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) /
      86400000,
  );
}
export function displayDate(value: string, zone: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export function localInput(value: string | Date, zone: string) {
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (key: string) => p.find((x) => x.type === key)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
// Resolve a wall clock in the firm's zone; reject DST gaps/ambiguities explicitly.
export function toInstant(wall: string, zone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall))
    throw new Error("INVALID_DATE");
  const center = Date.parse(wall + "Z");
  if (!Number.isFinite(center)) throw new Error("INVALID_DATE");
  const offsets = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const probe = center + delta;
    offsets.add(Date.parse(localInput(new Date(probe), zone) + "Z") - probe);
  }
  const candidates = [...offsets]
    .map((offset) => new Date(center - offset))
    .filter((date) => localInput(date, zone) === wall);
  if (candidates.length !== 1) throw new Error("INVALID_DATE");
  return candidates[0]!.toISOString();
}
export function awaitingResult(
  startsAt: string,
  settings: {
    timezone: string;
    eod_reminder_enabled: boolean;
    eod_reminder_time: string;
  },
  now = new Date(),
) {
  if (!settings.eod_reminder_enabled || new Date(startsAt) > now) return false;
  const day = localDay(startsAt, settings.timezone),
    today = localDay(now, settings.timezone);
  return (
    day < today ||
    (day === today &&
      localInput(now, settings.timezone).slice(11) >=
        settings.eod_reminder_time.slice(0, 5))
  );
}
