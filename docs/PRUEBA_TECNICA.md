# CALCE — prueba técnica del expediente

Esta versión permite usar el recorrido con datos ficticios. No es una instalación
productiva ni la web pública de marketing. Los cambios se entregan en ramas/PRs:
base #1 → datos #2 → interfaz e integración #3. La última rama contiene todo.

## Arranque local

Requisitos: Git, Node 24 (ver .nvmrc), npm y Docker Desktop funcionando.
No necesitas contratar hosting ni abrir un proyecto remoto de Supabase.

```bash
git clone https://github.com/IorekAhai7/CALCE.git
cd CALCE
git switch feat/private-case-workflow
npm ci
npm run db:start
npm run db:reset
npm run env:local
npm run dev
```

Si ya tienes el repositorio, usa `git fetch origin` y cambia a esa rama con el
árbol de trabajo limpio. `db:reset` BORRA el contenido de la base local y recrea
únicamente las muestras. No lo ejecutes si necesitas conservar trabajo local.
`env:local` genera archivos de configuración ignorados por Git sin imprimir llaves.

Abre http://localhost:3000 y pulsa **Acceder al sistema**.

| Cuenta ficticia | Papel |
|---|---|
| admin.a@calce.test | Administrador del despacho A |
| lawyer.a@calce.test | Segundo abogado del despacho A |
| admin.b@calce.test | Administrador del despacho B, aislado de A |
| inactive.a@calce.test | Cuenta con membresía inactiva; no debe entrar al despacho |

Contraseña LOCAL para las cuatro cuentas: `CalceDemo!2026`.
Estas cuentas sólo están en `seed.sql`; nunca cargar ese archivo en producción.

## Recorrido principal (20–30 minutos)

1. Entra como `admin.a@calce.test`. Verás **Hoy**, con muestras de agenda y tareas.
2. En **Clientes**, registra un cliente inventado con teléfono/correo y canal de llegada.
   Búscalo por nombre, abre su ficha y cambia el teléfono en **Editar datos del cliente**.
3. Desde su ficha, abre un asunto y asigna **Abogado Demo A** como responsable.
   Ambos abogados del despacho podrán verlo aunque sólo uno sea responsable.
4. Abre **Agendar evento**, registra una audiencia para mañana y observa el semáforo.
   Cambia la fecha y escribe un motivo. Deben conservarse la fecha anterior y el motivo.
5. Sube un PDF o fotografía de prueba, de hasta 10 MB. Descárgalo y compara el archivo.
   Tipos admitidos: PDF, JPEG, PNG y WebP. HEIC todavía no se admite; usa JPEG desde el móvil.
6. En **Registrar lo ocurrido**, selecciona el evento, indica una fecha/hora pasada,
   escribe notas ficticias y crea el siguiente pendiente con su fecha.
   Al guardar deben aparecer el movimiento, el evento con resultado registrado y el pendiente.
7. En **Agenda** comprueba que se retiró el evento ya registrado y se conserva el pendiente abierto.
   **Hoy** muestra pendientes para hoy/vencidos y los próximos ocho eventos.
8. Marca el pendiente como completado. Su registro debe seguir visible dentro del asunto.
9. Archiva el asunto: sale de Hoy/Agenda, conserva historia y documentos y bloquea nuevas capturas.
   Reábrelo para seguir trabajando.
10. Cierra sesión. Volver a una dirección privada debe llevarte al login.

Todas las fechas/horas de eventos y movimientos se capturan y muestran en la zona
del despacho (muestras: America/Mexico_City), aunque el equipo tenga otra zona.
Los pendientes tienen fecha, sin hora. El semáforo representa urgencia operativa;
no calcula plazos procesales ni incumplimiento de pagos.

## Pruebas de colaboración y rechazo

- En una ventana privada entra como `lawyer.a@calce.test`: debe ver el asunto anterior
  y descargar su documento.
- Copia la dirección del asunto y del enlace **Descargar documento**. Entra como
  `admin.b@calce.test`: esas direcciones deben responder sin mostrar los datos de A.
- `inactive.a@calce.test` puede autenticarse, pero debe ver **Sin acceso activo**.
- Una contraseña errónea debe mostrar un error genérico sin revelar información de la cuenta.
- Un archivo HTML renombrado a .pdf debe ser rechazado por la aplicación.
- En dos pestañas abre el mismo evento. Reprográmalo en una; al intentar guardar desde
  la otra debe pedir recargar, sin sobrescribir el cambio previo.
- No es válido registrar como ocurrido algo fechado en el futuro.

## Si se interrumpe una subida

La subida reserva primero un registro **PENDING**, recibe bytes en Storage y confirma
el resultado como **READY** sólo cuando tamaño y tipo coinciden. Son dos sistemas:
no se promete una transacción única entre PostgreSQL y Storage.

Si aparecen bytes recibidos pero falta confirmación, usa **Confirmar carga**.
Si el envío no llegó, **Descartar carga pendiente** conserva el registro y permite
volver a subir el archivo mediante una nueva reserva. Sólo quien inició la carga
puede confirmarla/descartarla. Los documentos confirmados no se sobrescriben.
Los bytes de cargas descartadas requieren limpieza administrativa futura; no quedan
accesibles a usuarios. No hay borrado automático de expedientes o documentos.

## Comprobaciones automatizadas

```bash
npm run check
npm run db:lint
npm run db:test
npm run env:local
npm run test:integration
npx playwright install chromium
npm run build
npm run test:e2e
```

`test:integration` usa únicamente un Supabase LOCAL y modifica datos ficticios.
Las credenciales administrativas sólo se utilizan en las pruebas para revocar y
restaurar un perfil; la aplicación usa exclusivamente la identidad del usuario.
Playwright recorre los formularios, verifica bytes descargados, otra cuenta del
mismo despacho, otro despacho, cierre de sesión, cuenta inactiva y vista móvil.
Las pruebas HTTP comprueban además sobrescritura/borrado prohibidos y concurrencia.

Para detener Supabase: `npm run db:stop`.

## Límites de esta entrega

- Interfaz provisional para validar el recorrido con los abogados; aún sin aprobación de UX.
- Agenda en lista cronológica; falta calendario mensual/semanal visual.
- No hay finanzas, campañas, IA, web pública ni despliegue remoto.
- No hay autoservicio de altas, invitaciones, recuperación de contraseña ni MFA configurado.
- El piloto no está preparado para grandes volúmenes. Las vistas de urgencia rechazan
  resultados truncados de 1000 registros; clientes permite afinar búsqueda tras 100 resultados.
- Los documentos se vinculan al asunto; aún no a un movimiento concreto. La validación
  inicial de firma/tipo no es un análisis antivirus ni una comprobación completa del PDF.
- Debe probarse la restauración de base de datos Y bytes de Storage antes de datos reales.
- ESLint 9 sigue temporalmente fijado: el plugin React del conjunto Next aún declara
  soporte hasta 9. La actualización compatible queda pendiente antes del cierre de M0.

Mañana registraremos observaciones por paso: qué esperabas, qué ocurrió y qué te
resultó confuso. La aprobación importante será que tus papás completen el recorrido
sin que tengamos que explicar cada botón.
