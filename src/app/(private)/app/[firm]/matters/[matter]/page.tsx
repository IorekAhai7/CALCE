import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { firmAccess, firmSettings, rows } from "@/lib/access";
import { ActionForm } from "@/components/action-form";
import { Field, Hidden, Select } from "@/components/fields";
import { RiskBadge } from "@/components/risk-badge";
import * as actions from "@/modules/cases/actions";
import {
  eventKinds,
  states,
  type Matter,
  type Client,
  type Event,
  type Task,
  type Movement,
  type Document,
  type EventChange,
  teamSchema,
} from "@/modules/cases/types";
import { displayDate, localInput } from "@/modules/cases/dates";
export default async function MatterPage({
  params,
}: {
  params: Promise<{ firm: string; matter: string }>;
}) {
  const { firm, matter } = await params;
  if (!z.uuid().safeParse(matter).success) notFound();
  const { client, member } = await firmAccess(firm);
  const record = await client
    .from("matters")
    .select("*")
    .eq("firm_id", firm)
    .eq("id", matter)
    .maybeSingle<Matter>();
  if (record.error) throw new Error("No fue posible consultar el asunto.");
  if (!record.data) notFound();
  const m = record.data;
  const [c, e, t, v, d, h, teamResult, settings] = await Promise.all([
    client.from("clients").select("*").eq("id", m.client_id).single<Client>(),
    client
      .from("events")
      .select("*")
      .eq("firm_id", firm)
      .eq("matter_id", matter)
      .order("starts_at")
      .returns<Event[]>(),
    client
      .from("tasks")
      .select("*")
      .eq("firm_id", firm)
      .eq("matter_id", matter)
      .order("due_on")
      .returns<Task[]>(),
    client
      .from("movements")
      .select("*")
      .eq("firm_id", firm)
      .eq("matter_id", matter)
      .order("occurred_at", { ascending: false })
      .returns<Movement[]>(),
    client
      .from("documents")
      .select("*")
      .eq("firm_id", firm)
      .eq("matter_id", matter)
      .order("created_at", { ascending: false })
      .returns<Document[]>(),
    client
      .from("event_changes")
      .select("*,events!inner(matter_id)")
      .eq("firm_id", firm)
      .eq("events.matter_id", matter)
      .order("created_at")
      .returns<EventChange[]>(),
    client.rpc("firm_team", { p_firm: firm }),
    firmSettings(firm),
  ]);
  const owner = rows(c),
    events = rows(e),
    tasks = rows(t),
    movements = rows(v),
    documents = rows(d),
    history = rows(h),
    team = teamSchema.parse(rows(teamResult));
  if (
    [events, tasks, movements, documents, history].some((a) => a.length >= 1000)
  )
    throw new Error("El piloto requiere paginación para este volumen.");
  const open = m.status === "OPEN",
    zone = settings.timezone;
  return (
    <>
      <Link href={`/app/${firm}/matters`}>← Asuntos</Link>
      <h1>{m.title}</h1>
      <p>
        Cliente:{" "}
        <Link href={`/app/${firm}/clients/${owner.id}`}>{owner.name}</Link> ·
        Responsable:{" "}
        {team.find((x) => x.id === m.responsible_id)?.display_name ??
          "Responsable no activo"}
      </p>
      <p className="preserve">{m.description}</p>
      {open ? (
        <RiskBadge events={events} tasks={tasks} settings={settings} />
      ) : (
        <p className="notice">
          Asunto archivado. Su historia y documentos siguen disponibles.
          Reábrelo para registrar cambios.
        </p>
      )}
      <nav className="tabs" aria-label="Secciones del asunto">
        <a href="#events">Eventos</a>
        <a href="#tasks">Pendientes</a>
        <a href="#movement">Registrar resultado</a>
        <a href="#documents">Documentos</a>
        <a href="#history">Historia</a>
      </nav>
      <p className="muted">Todas las horas corresponden a {zone}.</p>
      <div className="columns">
        <section id="events">
          <h2>Eventos del asunto</h2>
          {!events.length && <p className="empty">Todavía no hay eventos.</p>}
          {events.map((event) => (
            <article className="panel" key={event.id}>
              <h3>{event.title}</h3>
              <p>
                {eventKinds[event.kind as keyof typeof eventKinds]} ·{" "}
                {displayDate(event.starts_at, zone)}
              </p>
              <p>{event.location}</p>
              <span className="badge">{states[event.status]}</span>
              {history
                .filter((h) => h.event_id === event.id)
                .map((change) => (
                  <p className="muted" key={change.id}>
                    Reprogramado: {displayDate(change.old_starts_at, zone)} →{" "}
                    {displayDate(change.new_starts_at, zone)}. Motivo:{" "}
                    {change.reason}
                  </p>
                ))}
              {open && event.status === "SCHEDULED" && (
                <details>
                  <summary>Cambiar fecha o cancelar</summary>
                  <ActionForm
                    action={actions.rescheduleEvent}
                    submit="Reprogramar"
                  >
                    <Hidden firm={firm} />
                    <input type="hidden" name="event" value={event.id} />
                    <input type="hidden" name="version" value={event.version} />
                    <Field
                      label="Nueva fecha y hora"
                      name="starts_at"
                      type="datetime-local"
                      required
                      defaultValue={localInput(event.starts_at, zone)}
                    />
                    <Field
                      label="Motivo del cambio"
                      name="reason"
                      required
                      maxLength={1000}
                    />
                  </ActionForm>
                  <ActionForm
                    action={actions.cancelEvent}
                    submit="Cancelar evento"
                  >
                    <Hidden firm={firm} />
                    <input type="hidden" name="event" value={event.id} />
                    <input type="hidden" name="version" value={event.version} />
                  </ActionForm>
                </details>
              )}
            </article>
          ))}
          {open && (
            <details className="panel">
              <summary>Agendar evento</summary>
              <ActionForm action={actions.addEvent} submit="Guardar evento">
                <Hidden firm={firm} matter={matter} />
                <Field
                  label="Nombre del evento"
                  name="title"
                  required
                  maxLength={180}
                />
                <Select label="Tipo de evento" name="kind">
                  {Object.entries(eventKinds).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Field
                  label="Fecha y hora del evento"
                  name="starts_at"
                  type="datetime-local"
                  required
                />
                <Field label="Lugar" name="location" maxLength={300} />
              </ActionForm>
            </details>
          )}
        </section>
        <section id="tasks">
          <h2>Pendientes</h2>
          {!tasks.length && <p className="empty">Todavía no hay pendientes.</p>}
          {tasks.map((task) => (
            <article className="panel" key={task.id}>
              <h3>{task.title}</h3>
              <p>
                Fecha: {task.due_on} · {states[task.status]}
              </p>
              {open && task.status === "OPEN" && (
                <ActionForm
                  action={actions.closeTask}
                  submit="Actualizar pendiente"
                >
                  <Hidden firm={firm} />
                  <input type="hidden" name="task" value={task.id} />
                  <Select label="Nuevo estado" name="status">
                    <option value="DONE">Completado</option>
                    <option value="CANCELLED">Cancelado</option>
                  </Select>
                </ActionForm>
              )}
            </article>
          ))}
          {open && (
            <details className="panel">
              <summary>Crear pendiente</summary>
              <ActionForm action={actions.addTask} submit="Guardar pendiente">
                <Hidden firm={firm} matter={matter} />
                <Field
                  label="Descripción del pendiente"
                  name="title"
                  required
                  maxLength={180}
                />
                <Field
                  label="Fecha del pendiente"
                  name="due_on"
                  type="date"
                  required
                />
              </ActionForm>
            </details>
          )}
        </section>
      </div>
      <div className="columns">
        <section id="movement" className="panel">
          <h2>Registrar lo ocurrido</h2>
          {open ? (
            <ActionForm
              action={actions.recordMovement}
              submit="Guardar resultado"
            >
              <Hidden firm={firm} matter={matter} />
              <Select label="Evento relacionado" name="event" required={false}>
                <option value="">Movimiento independiente</option>
                {events
                  .filter((e) => e.status === "SCHEDULED")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
              </Select>
              <Field
                label="Cuándo ocurrió"
                name="occurred_at"
                type="datetime-local"
                required
                defaultValue={localInput(new Date(), zone)}
              />
              <label>
                Resultado y notas
                <textarea name="notes" required maxLength={10000} rows={5} />
              </label>
              <p className="muted">
                Opcional: crea el siguiente pendiente junto con este resultado.
              </p>
              <Field
                label="Siguiente pendiente"
                name="next_title"
                maxLength={180}
              />
              <Field
                label="Fecha del siguiente pendiente"
                name="next_due"
                type="date"
              />
            </ActionForm>
          ) : (
            <p>Reabre el asunto para registrar un resultado.</p>
          )}
        </section>
        <section id="documents">
          <h2>Documentos privados</h2>
          {open && (
            <div className="panel">
              <ActionForm
                action={actions.uploadDocument}
                submit="Subir documento"
              >
                <Hidden firm={firm} matter={matter} />
                <Field
                  label="Archivo PDF o imagen (máximo 10 MB)"
                  name="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  required
                />
              </ActionForm>
            </div>
          )}
          {!documents.length && (
            <p className="empty">Todavía no hay documentos.</p>
          )}
          {documents.map((doc) => (
            <article className="panel" key={doc.id}>
              <h3>{doc.name}</h3>
              <p>
                {Math.ceil(doc.byte_size / 1024)} KB ·{" "}
                {displayDate(doc.created_at, zone)}
              </p>
              {doc.status === "READY" ? (
                <a href={`/api/documents/${doc.id}`}>Descargar documento</a>
              ) : doc.status === "CANCELLED" ? (
                <p>Carga descartada</p>
              ) : (
                <>
                  <p>Carga pendiente de confirmación</p>
                  {doc.actor_id === member.id && (
                    <>
                      <ActionForm
                        action={actions.finishDocument}
                        submit="Confirmar carga"
                      >
                        <Hidden firm={firm} />
                        <input type="hidden" name="document" value={doc.id} />
                      </ActionForm>
                      <ActionForm
                        action={actions.cancelDocument}
                        submit="Descartar carga pendiente"
                      >
                        <Hidden firm={firm} />
                        <input type="hidden" name="document" value={doc.id} />
                      </ActionForm>
                    </>
                  )}
                </>
              )}
            </article>
          ))}
        </section>
      </div>
      <section id="history">
        <h2>Historia de movimientos</h2>
        {!movements.length && (
          <p className="empty">Los resultados registrados aparecerán aquí.</p>
        )}
        {movements.map((move) => (
          <article className="panel" key={move.id}>
            <h3>{displayDate(move.occurred_at, zone)}</h3>
            <p>
              {move.event_id
                ? events.find((e) => e.id === move.event_id)?.title
                : "Movimiento independiente"}
            </p>
            <p className="preserve">{move.notes}</p>
          </article>
        ))}
      </section>
      <details className="panel">
        <summary>{open ? "Archivar asunto" : "Reabrir asunto"}</summary>
        <p>
          {open
            ? "Al archivarlo dejará de aparecer en Hoy y en la agenda. Se conservarán sus registros."
            : "Al reabrirlo volverán a aparecer sus eventos y pendientes abiertos."}
        </p>
        <ActionForm
          action={actions.archiveMatter}
          submit={open ? "Confirmar archivo" : "Reabrir asunto"}
        >
          <Hidden firm={firm} matter={matter} />
          <input type="hidden" name="archived" value={String(open)} />
        </ActionForm>
      </details>
    </>
  );
}
