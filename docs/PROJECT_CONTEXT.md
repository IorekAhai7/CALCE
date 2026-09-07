# Contexto y decisiones de Foundation M0

## Producto

CALCE ABOGADOS tiene una web pública de confianza y captación y una aplicación
privada para dos abogados. Las acciones frecuentes se realizan desde el Asunto.
El primer recorrido será Hoy → audiencia → asunto → resultado → foto/pendiente.

Un evento sin resultado genera un recordatorio dentro de la aplicación al cierre
del día. El sistema nunca deduce que la audiencia ocurrió. La reprogramación conserva
la fecha anterior. Las fechas se presentan en la zona horaria del despacho.

El semáforo operativo usa límites configurables (por defecto 2 y 7 días).
Ingresos esperados, pagos recibidos, gastos del caso y gastos generales son conceptos
distintos. Campañas e indicadores llegarán por entregas; sus métricas serán derivadas.

## Decisiones técnicas

- Next.js + React + TypeScript; monolito modular con PostgreSQL y Supabase.
- Un proyecto web, con contextos público y privado separados.
- Base compartida con firm_id, RLS y claves foráneas compuestas cuando corresponda.
- Perfiles separados de membresías: un usuario puede pertenecer a más de un despacho.
- En esta entrega sólo se leen perfiles propios. La lectura de perfiles de compañeros
  llegará con el caso de uso de asignación y su autorización explícita.
- Alta de despachos, usuarios y cambios de rol siguen reservados al aprovisionamiento;
  no se expone CRUD genérico de membresías.
- El admin puede modificar los umbrales/recordatorios de su despacho. El trigger
  registra actor y cambios de configuración. Los usuarios no escriben auditoría directamente.
- El helper SECURITY DEFINER de membresía resuelve auth.uid(), comprueba perfil y
  despacho activos y evita recursión de RLS. Tiene search_path fijo y grants restringidos.
- El bucket legal-documents se crea privado y sin políticas de acceso para usuarios.
  Se habilitarán al incorporar la relación documento/asunto y probar los bytes por HTTP.
- El esquema inicial es parcial respecto del modelo completo aprobado; no se considera
  una implementación completa del dominio.

## Alcance del PR inicial

El repositorio y la ruta de CI concretan el inicio de M0. Incluyen una migración de
identidad/tenant, auditoría inicial, fixtures y pruebas adversariales. La regla pura
de semáforo ya prueba los umbrales aprobados; todavía no consulta agenda ni configura plazos legales.

El M0 completo exige después sesión verificada en servidor, relaciones de clientes/asuntos,
metadatos documentales, subida y descarga privadas y sus pruebas de integración.
Las comprobaciones de esta entrega no prueban todavía esas funcionalidades.

## Compatibilidad verificada durante preparación

El registro de paquetes y la documentación oficial se consultaron el 7 de septiembre de 2026.
Next.js 16.3.4 y React 19.2.8 se fijaron como base. La primera comprobación detectó
que typescript-eslint rechaza TypeScript 7; se selecciona TypeScript 6 y ESLint 9
para mantener compatibilidad con el conjunto de analizadores. package.json y el lockfile
contienen las versiones exactas. No se usa un framework sustituto ni se selecciona hosting aún.

ESLint 9 es una fijación temporal: su mantenimiento terminó el 6 de agosto de 2026,
pero eslint-plugin-react 7.37.5, incluido por Next, todavía declara compatibilidad
hasta ESLint 9. No se fuerzan dependencias incompatibles. Antes de cerrar M0 se debe
resolver la actualización del analizador con un conjunto compatible y mantenido.
Referencia: [soporte oficial de ESLint](https://eslint.org/version-support/).

Referencias de implementación:

- [Instalación de Next.js](https://nextjs.org/docs/app/getting-started/installation)
- [Seguridad de datos en Next.js](https://nextjs.org/docs/app/guides/data-security)
- [Supabase local](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Pruebas de Supabase](https://supabase.com/docs/guides/local-development/testing/overview)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Respaldos de base de datos y límites de Storage](https://supabase.com/docs/guides/platform/backups)

## Publicación y datos

El repositorio contiene código y contexto técnico, sin expedientes, credenciales ni
activos personales del handoff. El uso con datos reales exige recuperar tanto base
de datos como archivos, validar el aviso de privacidad y preparar una carga inicial acotada.
La marca y la migración de dominio se trabajan antes de la publicación de la web.
