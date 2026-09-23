import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { firmAccess, rows } from "@/lib/access";
import { ActionForm } from "@/components/action-form";
import { Field, Hidden, Select } from "@/components/fields";
import { ClientFields } from "@/components/client-fields";
import { saveClient, createMatter } from "@/modules/cases/actions";
import { teamSchema, type Client, type Matter } from "@/modules/cases/types";
export default async function ClientDetail({
  params,
}: {
  params: Promise<{ firm: string; client: string }>;
}) {
  const { firm, client: clientId } = await params;
  if (!z.uuid().safeParse(clientId).success) notFound();
  const { client } = await firmAccess(firm);
  const record = await client
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("firm_id", firm)
    .maybeSingle<Client>();
  if (record.error) throw new Error("No fue posible consultar el cliente.");
  if (!record.data) notFound();
  const c = record.data;
  const [m, t] = await Promise.all([
    client
      .from("matters")
      .select("*")
      .eq("firm_id", firm)
      .eq("client_id", c.id)
      .order("created_at", { ascending: false })
      .returns<Matter[]>(),
    client.rpc("firm_team", { p_firm: firm }),
  ]);
  const matters = rows(m),
    team = teamSchema.parse(rows(t));
  return (
    <>
      <Link href={`/app/${firm}/clients`}>← Clientes</Link>
      <h1>{c.name}</h1>
      <div className="columns">
        <section>
          <h2>Asuntos del cliente</h2>
          {!matters.length && (
            <p className="empty">Este cliente todavía no tiene asuntos.</p>
          )}
          <ul className="cards">
            {matters.map((m) => (
              <li key={m.id}>
                <Link href={`/app/${firm}/matters/${m.id}`}>{m.title}</Link>
                <p>{m.status === "OPEN" ? "Abierto" : "Archivado"}</p>
              </li>
            ))}
          </ul>
          <details className="panel">
            <summary>Editar datos del cliente</summary>
            <ActionForm action={saveClient}>
              <Hidden firm={firm} />
              <input type="hidden" name="client" value={c.id} />
              <ClientFields client={c} />
            </ActionForm>
          </details>
        </section>
        <section className="panel">
          <h2>Abrir asunto</h2>
          <ActionForm action={createMatter} submit="Crear asunto">
            <Hidden firm={firm} />
            <input type="hidden" name="client" value={c.id} />
            <Field
              label="Nombre del asunto"
              name="title"
              required
              maxLength={180}
            />
            <Select label="Abogado responsable" name="responsible">
              {team.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </Select>
            <label>
              Descripción inicial
              <textarea name="description" maxLength={5000} rows={4} />
            </label>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
