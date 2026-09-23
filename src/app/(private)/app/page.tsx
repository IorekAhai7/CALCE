import Link from "next/link";
import { session, rows } from "@/lib/access";
import { redirect } from "next/navigation";
import { logout } from "@/modules/cases/actions";
export default async function AppIndex() {
  const { client } = await session();
  const firms = rows(
    await client
      .from("firms")
      .select("id,name")
      .order("name")
      .returns<{ id: string; name: string }[]>(),
  );
  if (firms.length === 1) redirect(`/app/${firms[0]!.id}`);
  return (
    <main className="container">
      <h1>{firms.length ? "Selecciona un despacho" : "Sin acceso activo"}</h1>
      {!firms.length && (
        <p>
          Tu cuenta no tiene un despacho activo. Solicita apoyo al
          administrador.
        </p>
      )}
      {firms.map((f) => (
        <p key={f.id}>
          <Link href={`/app/${f.id}`}>{f.name}</Link>
        </p>
      ))}
      <form action={logout}>
        <button>Cerrar sesión</button>
      </form>
    </main>
  );
}
