import Link from "next/link";
import { overview } from "@/modules/cases/queries";
import { displayDate } from "@/modules/cases/dates";
export default async function Agenda({
  params,
}: {
  params: Promise<{ firm: string }>;
}) {
  const { firm } = await params;
  const { matters, events, tasks, settings } = await overview(firm);
  const name = (id: string) =>
    matters.find((m) => m.id === id)?.title ?? "Asunto";
  return (
    <>
      <h1>Agenda del despacho</h1>
      <p>
        Eventos programados y pendientes de asuntos abiertos. Horario:{" "}
        {settings.timezone}.
      </p>
      <div className="columns">
        <section>
          <h2>Eventos</h2>
          <ul className="cards">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/app/${firm}/matters/${e.matter_id}#events`}>
                  {e.title}
                </Link>
                <p>
                  {displayDate(e.starts_at, settings.timezone)} ·{" "}
                  {name(e.matter_id)}
                </p>
                <p>{e.location}</p>
              </li>
            ))}
          </ul>
          {!events.length && <p className="empty">Sin eventos programados.</p>}
        </section>
        <section>
          <h2>Pendientes</h2>
          <ul className="cards">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link href={`/app/${firm}/matters/${t.matter_id}#tasks`}>
                  {t.title}
                </Link>
                <p>
                  {t.due_on} · {name(t.matter_id)}
                </p>
              </li>
            ))}
          </ul>
          {!tasks.length && <p className="empty">Sin pendientes abiertos.</p>}
        </section>
      </div>
    </>
  );
}
