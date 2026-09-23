"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="container">
      <h1>No pudimos cargar esta sección</h1>
      <p>
        Tu operación puede haberse guardado. Recarga y revisa el registro antes
        de repetirla.
      </p>
      <button onClick={reset}>Volver a intentar</button>
    </main>
  );
}
