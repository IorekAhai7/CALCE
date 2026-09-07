# CALCE ABOGADOS

Base técnica de la web y del sistema de gestión del despacho. El producto se
organiza alrededor del Asunto: historia, agenda, pendientes, documentos y finanzas.

## Estado

Primera entrega de Foundation M0, todavía sin pantallas funcionales:

- Next.js App Router, React, TypeScript estricto y Tailwind.
- Lint, comprobación de tipos, Vitest y compilación reproducibles.
- PostgreSQL/Supabase local: despachos, perfiles, membresías, configuración y auditoría.
- RLS inicial, permisos mínimos, protección de roles y auditoría de configuración.
- Dos despachos ficticios y pruebas pgTAP de aislamiento, revocación e integridad.
- Bucket privado reservado para documentos; acceso a archivos todavía cerrado.
- GitHub Actions para la aplicación y la base de datos.

Pendiente para completar M0: sesión técnica de aplicación, clientes/asuntos,
metadatos y acceso seguro a documentos, pruebas HTTP de Auth/Storage y recuperación.
Después sigue el prototipo validado con los abogados. El sitio no se despliega en esta entrega.

## Ejecutar la aplicación

Requisitos: Node 24 (versión en .nvmrc) y npm. Desde la raíz:

```bash
npm ci
npm run check
npm run dev
```

La página inicial es un aviso técnico de preparación. GET /api/health comprueba
que responde el proceso web; no comprueba la base de datos ni declara disponibilidad del producto.
La base inicial compila sin credenciales ni servicios remotos.

## Ejecutar la plataforma y sus pruebas

Además se necesita Docker Desktop o un runtime compatible con Docker. La CLI está
fijada en package.json; no se requiere instalar Supabase globalmente ni crear un proyecto remoto.

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:stop
```

db:reset reconstruye la base LOCAL y elimina su contenido previo. Usar únicamente
datos ficticios. Los comandos del proyecto incluyen --local para reset y lint.
La suite SQL cambia el rol y las claims de prueba para comprobar RLS; no sustituye
las futuras pruebas de inicio de sesión por HTTP. Las identidades ficticias no tienen contraseña.

Si el equipo de trabajo carece de Docker, las pruebas de base de datos se ejecutan
en el runner de GitHub Actions, que inicia su propia plataforma efímera.

## Organización

- src/app: adaptadores y rutas de Next.js.
- src/modules: dominio y casos de uso por módulo; sólo se crean los que tienen código.
- supabase/migrations: cambios de esquema y permisos.
- supabase/seed.sql: fixtures locales/CI.
- supabase/tests/database: pruebas de PostgreSQL con pgTAP.
- tests/unit: reglas puras de dominio.
- docs: decisiones y contexto de ingeniería.

Leer AGENTS.md y docs/PROJECT_CONTEXT.md antes de contribuir.
