import Link from "next/link";
export default function NotFound() {
  return (
    <main className="container">
      <h1>Registro no disponible</h1>
      <p>No existe o tu cuenta no tiene acceso.</p>
      <Link href="/app">Volver al despacho</Link>
    </main>
  );
}
