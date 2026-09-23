import Link from "next/link";
import { firmAccess, rows } from "@/lib/access";
import { ActionForm } from "@/components/action-form";
import { Field, Hidden } from "@/components/fields";
import { ClientFields } from "@/components/client-fields";
import { saveClient } from "@/modules/cases/actions";
import type { Client } from "@/modules/cases/types";
export default async function Clients({
  params,
  searchParams,
}: {
  params: Promise<{ firm: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { firm } = await params,
    { q = "" } = await searchParams;
  const { client } = await firmAccess(firm);
  const query = q
    .trim()
    .slice(0, 160)
    .replace(/[\\%_]/g, "\\$&");
  const clients = rows(
    await client
      .from("clients")
      .select("*")
      .eq("firm_id", firm)
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(101)
      .returns<Client[]>(),
  );
  return (
    <>
      <h1>Clientes</h1>
      <div className="columns">
        <section>
          <form method="get" className="search">
            <Field
              label="Buscar por nombre"
              name="q"
              defaultValue={q}
              maxLength={160}
            />
            <button>Buscar</button>
          </form>
          {!clients.length && (
            <p className="empty">
              No hay clientes con ese nombre. Puedes registrar uno.
            </p>
          )}
          <ul className="cards">
            {clients.slice(0, 100).map((c) => (
              <li key={c.id}>
                <Link href={`/app/${firm}/clients/${c.id}`}>{c.name}</Link>
                <p>
                  {c.phone || "Sin teléfono"} · {c.email || "Sin correo"}
                </p>
              </li>
            ))}
          </ul>
          {clients.length > 100 && (
            <p>
              Se muestran 100 resultados. Especifica el nombre para afinar la
              búsqueda.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Registrar cliente</h2>
          <ActionForm action={saveClient} submit="Crear cliente">
            <Hidden firm={firm} />
            <ClientFields />
          </ActionForm>
        </section>
      </div>
    </>
  );
}
