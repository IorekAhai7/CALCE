import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CALCE ABOGADOS — Preparación",
  description: "Entorno técnico inicial de CALCE ABOGADOS.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-MX"><body>{children}</body></html>;
}
