import Link from "next/link";
import { overview } from "@/modules/cases/queries";
import { awaitingResult, displayDate, localDay } from "@/modules/cases/dates";
export default async function Today({
  params,
}: {
  params: Promise<{ firm: string }>;
}) {
  const { firm } = await params;
  const { matters, events, tasks, settings } = await overview(firm);
  const today = localDay(new Date(), settings.timezone);
  const pendingResults = events.filter((e) =>
    awaitingResult(e.starts_at, settings),
  );
  const due = tasks.filter((t) => t.due_on <= today);
  const upcoming = events
    .filter((e) => localDay(e.starts_at, settings.timezone) >= today)
    .slice(0, 8);
  const matterName = (id: string) =>
    matters.find((m) => m.id === id)?.title ?? "Asunto";
  return (
    <>
      <h1>Hoy</h1>
      <p className="muted">
        {today} · Horario del despacho: {settings.timezone}
      </p>
      <div className="stats">
        <div>
          <strong>{due.length}</strong>pendientes para hoy o vencidos
        </div>
        <div>
          <strong>{pendingResults.length}</strong>eventos por registrar
        </div>
        <div>
          <strong>{matters.filter((m) => m.status === "OPEN").length}</strong>
          asuntos abiertos
        </div>
      </div>
      <div className="columns">
        <section>
          <h2>Pendientes que requieren atención</h2>
          {!due.length && (
            <p className="empty">No hay pendientes para hoy ni vencidos.</p>
          )}
          <ul className="cards">
            {due.map((t) => (
              <li key={t.id}>
                <Link href={`/app/${firm}/matters/${t.matter_id}#tasks`}>
                  {t.title}
                </Link>
                <p>
                  {matterName(t.matter_id)} · Fecha: {t.due_on}
                </p>
              </li>
            ))}
          </ul>
          <h2>¿Qué ocurrió?</h2>
          <p>
            Estos eventos requieren que registres el resultado o actualices su
            fecha. No se marcan como realizados automáticamente.
          </p>
          <ul className="cards">
            {pendingResults.map((e) => (
              <li key={e.id}>
                <Link href={`/app/${firm}/matters/${e.matter_id}#movement`}>
                  {e.title}
                </Link>
                <p>{displayDate(e.starts_at, settings.timezone)}</p>
              </li>
            ))}
          </ul>
          {!pendingResults.length && (
            <p className="empty">No hay recordatorios de resultado.</p>
          )}
        </section>
        <section>
          <h2>Próximos eventos</h2>
          <ul className="cards">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link href={`/app/${firm}/matters/${e.matter_id}#events`}>
                  {e.title}
                </Link>
                <p>{displayDate(e.starts_at, settings.timezone)}</p>
                <p>{matterName(e.matter_id)}</p>
              </li>
            ))}
          </ul>
          {!upcoming.length && (
            <p className="empty">No hay eventos próximos.</p>
          )}
          <Link href={`/app/${firm}/agenda`}>
            Ver agenda y todos los pendientes →
          </Link>
        </section>
      </div>
    </>
  );
}
