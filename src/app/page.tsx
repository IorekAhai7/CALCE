import Link from "next/link";
export default function Home() {
  return (
    <main className="login">
      <p className="eyebrow">CALCE ABOGADOS</p>
      <h1>Gestión del despacho</h1>
      <p>Accede a tus asuntos, agenda y documentos.</p>
      <Link className="button" href="/login">
        Acceder al sistema
      </Link>
      <p className="muted">
        Versión técnica de prueba. La web pública del despacho se encuentra en
        preparación.
      </p>
    </main>
  );
}
