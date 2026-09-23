import Link from "next/link";
import { overview } from "@/modules/cases/queries";
import { RiskBadge } from "@/components/risk-badge";
export default async function Matters({
  params,
}: {
  params: Promise<{ firm: string }>;
}) {
  const { firm } = await params;
  const { matters, events, tasks, settings } = await overview(firm);
  return (
    <>
      <div className="heading">
        <h1>Asuntos</h1>
        <Link className="button" href={`/app/${firm}/clients`}>
          Abrir desde un cliente
        </Link>
      </div>
      {!matters.length && (
        <p className="empty">
          Registra un cliente para abrir su primer asunto.
        </p>
      )}
      <ul className="cards">
        {matters.map((m) => (
          <li key={m.id}>
            <Link href={`/app/${firm}/matters/${m.id}`}>{m.title}</Link>
            {m.status === "ARCHIVED" ? (
              <span className="badge">Archivado</span>
            ) : (
              <RiskBadge
                events={events.filter((e) => e.matter_id === m.id)}
                tasks={tasks.filter((t) => t.matter_id === m.id)}
                settings={settings}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
