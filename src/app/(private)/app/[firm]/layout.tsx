import Link from "next/link";
import { firmAccess } from "@/lib/access";
import { logout } from "@/modules/cases/actions";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ firm: string }>;
}) {
  const { firm } = await params;
  const access = await firmAccess(firm);
  return (
    <>
      <a className="skip" href="#content">
        Saltar al contenido
      </a>
      <header className="topbar">
        <Link href={`/app/${firm}`} className="brand">
          CALCE <span>ABOGADOS</span>
        </Link>
        <nav aria-label="Navegación principal">
          <Link href={`/app/${firm}`}>Hoy</Link>
          <Link href={`/app/${firm}/clients`}>Clientes</Link>
          <Link href={`/app/${firm}/matters`}>Asuntos</Link>
          <Link href={`/app/${firm}/agenda`}>Agenda</Link>
          <Link href="/app">Despacho</Link>
        </nav>
        <form action={logout}>
          <button className="secondary">Cerrar sesión</button>
        </form>
      </header>
      <main id="content" className="container">
        <p className="eyebrow">{access.firm.name}</p>
        {children}
      </main>
      <footer>CALCE ABOGADOS · Versión de prueba con datos ficticios</footer>
    </>
  );
}
