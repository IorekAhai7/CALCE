# CALCE ABOGADOS

Piloto técnico de gestión del despacho: acceso privado, clientes, asuntos, agenda,
pendientes, movimientos y documentos. Next.js + TypeScript + PostgreSQL/Supabase.

## Probar

La [guía de prueba técnica](docs/PRUEBA_TECNICA.md) incluye instalación, cuentas
ficticias, recorrido completo y casos de rechazo. La rama `feat/private-case-workflow`
contiene las entregas apiladas: foundation #1, datos #2 y aplicación #3.

```bash
npm ci
npm run db:start
npm run db:reset
npm run env:local
npm run dev
```

Requiere Node 24 y Docker. `db:reset` destruye únicamente la base local; usar muestras.
Abre http://localhost:3000. No se necesita un Supabase remoto para esta prueba.

## Verificación

- `npm run check`: lint, tipos, reglas de dominio y build.
- `npm run db:lint` y `npm run db:test`: esquema, transacciones y RLS con pgTAP.
- `npm run test:integration`: Auth/REST/Storage reales, revocación y concurrencia en local.
- `npm run test:e2e`: recorrido de navegador sobre el build (instalar Chromium primero).
- GitHub Actions prepara su propia instancia efímera y ejecuta las comprobaciones.

## Arquitectura

- `src/app`: páginas y adaptadores Next.js; sesión verificada en servidor.
- `src/modules/cases`: operaciones, consultas y reglas del expediente.
- `supabase/migrations`: esquema, RPCs transaccionales y políticas explícitas.
- `supabase/seed.sql`: cuentas y registros ficticios exclusivamente locales.
- `tests`: pruebas unitarias, SQL, HTTP y navegador.

La aplicación no usa service_role. Las escrituras pasan por operaciones específicas;
RLS y claves compuestas aíslan despachos. Los bytes permanecen privados, con una
reserva/confirmación explícita para manejar cargas interrumpidas.

## Alcance

Pantallas provisionales para prueba técnica. No incluye web pública, finanzas,
producción, recuperación validada ni UX aprobada por los abogados. M0 sigue abierto
hasta cerrar sus pendientes, incluida la actualización compatible de ESLint.

Leer [AGENTS.md](AGENTS.md), [contexto](docs/PROJECT_CONTEXT.md) y la guía antes de contribuir.
