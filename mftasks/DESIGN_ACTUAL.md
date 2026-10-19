# DESIGN_ACTUAL --- MF Tasks

## 1. Control del documento

| Campo | Valor |
|---|---|
| Fecha de análisis | 17/10/2026 |
| Tipo | Documento descriptivo del estado implementado |
| Alcance | Toda la aplicación frontend |
| Fuente | Código actual de `FRONTEND/mffrontend/my-app` |
| Relación con `DESIGN.md` | No lo reemplaza; este documento describe lo que existe hoy |

Este archivo no es una especificación aspiracional. Documenta la interfaz, los patrones y las inconsistencias reales del proyecto para usarlos como base de una futura unificación visual.

---

## 2. Resumen ejecutivo

- La aplicación comparte ahora una paleta global definida en `app/globals.css`: rojo corporativo, sidebar oscuro, superficies claras, texto slate e índigo para el detalle.
- Los componentes legacy conservan diferencias estructurales, pero los colores base, estados, bordes, botones primarios y fondos fueron alineados a los tokens globales.
- El shell global mantiene topbar roja, sidebar oscuro tipo drawer y botón de cerrar sesión con radio de control.
- La pantalla **Tareas en desarrollo** sigue siendo la más moderna y consistente: filtros, tabla responsive, detalle como página y tablero Kanban.
- Persisten múltiples implementaciones de modal, tabla, loading/error y algunos estilos inline, aunque con la misma paleta.
- Tailwind está instalado, pero se usa de forma marginal. Predominan CSS Modules y estilos inline.
- La accesibilidad es desigual: el sidebar y el detalle de tarea tienen buen trabajo de teclado, pero varios modales, toasts y formularios aún necesitan mejoras.

---

## 3. Shell global

### 3.1 Jerarquía

- `app/layout.tsx`: monta `VmErrorFilter`, autenticación MSAL, `ToastProvider` y `TasksWebSocketProvider`.
- `app/mfpages/layout.tsx`: envuelve las pantallas internas con `DashboardLayout`.
- `app/page.tsx`: pantalla de login, fuera del dashboard.
- `GuardRuta`: redirige a `/mfpages/perfil` si la ruta no corresponde y devuelve `null` mientras resuelve capacidades.

### 3.2 Topbar

| Propiedad | Valor actual |
|---|---|
| Altura | `52px` escritorio, `56px` en móvil |
| Fondo | `#c22105` |
| Texto | Blanco |
| Saludo | `<h1>Hola, {nombre}</h1>`, `20px`, `18px`, `16px` según breakpoint |
| Código de usuario | `11px`, opacidad `.9` |
| Botón menú | `36x36`, radio `8px`, icono `☰` |
| Cerrar sesión | Fondo `#CF3215`, hover `#f13b1b`, sin radio definido |
| Padding | `0 16px`, `0 12px` en tablet, `0 15px` en móvil |

El contenido principal tiene scroll propio. En escritorio no hay sidebar persistente: la navegación siempre se abre como drawer.

### 3.3 Sidebar

- Archivos: `components/Sidebar.tsx`, `components/Sidebar.css`.
- Es un drawer fijo visible solo al abrirse.
- Ancho: `min(280px, 86vw)`.
- Fondo: `#252525`; enlace activo y hover: `#525252`.
- Overlay: `rgba(0,0,0,.5)`, z-index `1001`; sidebar z-index `1002`.
- Logo: `mfsac.png`, altura `78px` en escritorio y `70px` en móvil.
- Enlaces: `16px`, altura mínima `54px`, radio `8px`; en móvil `18px` y `60px`.
- Cierre: clic en overlay, botón `X`, `Escape` o navegación.
- Accesibilidad: `aria-expanded`, `aria-controls`, foco al botón de cierre, restauración de foco, bloqueo de scroll y foco visible.

Menú según capacidades:

- Perfil: todos.
- Seguimiento de Solicitudes: cliente.
- Centro de solicitudes: admin.
- Administración de usuarios/campañas: admin.
- Bandeja de solicitudes y Tareas en desarrollo: personal interno no admin.
- Equipos: todos.

### 3.4 Contenido

- Padding: `20px` escritorio, `16px` tablet, `15px` móvil.
- Fondo blanco y `overflow-x: hidden`.
- No hay ancho máximo ni contenedor central; cada pantalla decide su layout.
- `GuardRuta` deja el contenido vacío mientras carga, sin skeleton global.

### 3.5 Login

- Archivo: `app/page.tsx`.
- No usa el shell ni CSS Module; todo es inline.
- Título “Portal de tareas”, botón de Microsoft y botón alternativo si hay error.
- Sin logo, tarjeta, spinner, fondo corporativo ni foco personalizado.
- Es la pantalla más alejada del lenguaje visual del resto de la aplicación.

---

## 4. Tokens y lenguaje visual real

### 4.1 Colores principales

La fuente de verdad es `app/globals.css`:

| Token | Valor | Uso |
|---|---|---|
| `--color-brand` | `#C8210A` | Topbar, acciones primarias y acentos |
| `--color-brand-hover` | `#A91F0A` | Hover de acciones primarias |
| `--color-sidebar` | `#242424` | Navegación lateral |
| `--color-sidebar-active` | `#515151` | Opción activa |
| `--color-background` | `#FFFFFF` | Fondo principal y texto sobre color |
| `--color-surface` | `#F2F3F5` | Paneles y superficies secundarias |
| `--color-border` | `#E0E3E8` | Bordes y divisores |
| `--color-text` | `#101828` | Texto principal |
| `--color-text-secondary` | `#64748B` | Etiquetas y metadatos |
| `--color-badge` | `#292844` | Roles y etiquetas compactas |
| `--color-detail-header` | `#3326B9` | Cabecera del detalle de solicitud |
| `--color-waiting` | `#B7791F` | En espera |
| `--color-in-progress` | `#1769AA` | En desarrollo |
| `--color-paused` | `#667085` | Stand-by |
| `--color-done` | `#25855A` | Solucionado y éxito |
| `--color-disabled` | `#F1F2F4` | Controles deshabilitados |
| `--color-danger` | `#B42318` | Errores, rechazo y acciones destructivas |
| `--color-focus` | `var(--color-detail-header)` | Foco visible |
| `--color-overlay` | `rgba(0,0,0,.5)` | Backdrops de sidebar y modales |

Los tonos suaves de badges y alertas se derivan con `color-mix()` a partir de estos tokens.

### 4.2 Tipografía

- Fuente global: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- No hay fuente corporativa ni escala formal.
- Tamaños reales entre `10px` y `21px`, más `1.5rem` en login.
- Pesos usados: `400`, `500`, `600`, `700`.
- Títulos de página: `18px/700` en Admin, Perfil y Equipos; `19px/700` en Tareas.
- Título de detalle: `21px/700`, `17px` en móvil y `15px` en pantallas muy pequeñas.
- Códigos y tickets usan monoespaciado en Admin, Perfil, Solicitudes y pantallas de éxito.

### 4.3 Variables CSS locales

- `Tareas.module.css`, `TareaDetalle.module.css` y `TaskTableEnDesarrollo.module.css` conservan alias `--mf-*` por compatibilidad, pero ahora apuntan a los tokens globales `--color-*`.
- No quedan definiciones de color duplicadas para la paleta principal.
- Los componentes legacy usan directamente `var(--color-*)` o `color-mix()` para tonos suaves.

### 4.4 Radios, controles y sombras

- Radios frecuentes: `6`, `8`, `10`, `12`, `14` y `999` px.
- Alturas de controles: `34`, `36`, `37`, `38` y `42` px.
- Sombras de modal: `0 20px 40px`, `0 20px 45px`, `0 20px 50px`.
- Transiciones: `.15s`, `.2s`, `.24s`, `.25s`, `.32s`, `.35s`; no hay token común.

### 4.5 z-index

| z-index | Uso |
|---:|---|
| `20` | Menú de acciones de subtarea |
| `50` | Dropdowns y overlays inline de Equipos |
| `60` | Modal inline de reasignación de Equipos |
| `999` | Modales legacy de tareas y solicitudes |
| `1000` | `Modal` compartido |
| `1001` | Overlay del sidebar |
| `1002` | Sidebar |
| `1200` | Pantallas de éxito y modal inline de reanudación |
| `9999` | Toast |

Los modales legacy (`999`) quedan por debajo del overlay del sidebar (`1001`).

---

## 5. Inventario de pantallas

### 5.1 Perfil --- `/mfpages/perfil`

- Propósito: datos de cuenta, alertas, campañas permitidas y preferencias de correo.
- Estructura: acordeones y tarjetas grises.
- Tarjetas: `#f3f4f6`, borde `#e5e7eb`, radio `12px`.
- Acordeones con chevron `▸`, cuerpo con scroll interno de `200px`.
- Grid de datos a dos columnas; una columna en `≤768px`.
- Preferencias con `Switch` y botón “Guardar cambios”.
- Estados de carga no visibles; errores silenciosos o toast.
- Observaciones: mezcla CSS Module, estilos inline y Tailwind; clases CSS sin uso; scroll interno incómodo en notificaciones.

### 5.2 Solicitudes --- `/mfpages/solicitudes`

Tiene dos modos:

**Admin: Centro de solicitudes**

- Tabla semántica con `SharedTable`.
- Columnas: Fecha solicitud, Solicitud, Estado, Equipo, Acciones.
- Paginación de 10.
- Filtros de campaña/subcampaña, estado y búsqueda.
- Fila clickeable que abre `components/tareas/TaskModal.tsx`.
- Estilo “Solo lectura”.

**Personal interno: Bandeja de solicitudes**

- Grid de `div`, no tabla semántica.
- Columnas: Fecha, Asunto, Cliente, Equipo, Acciones.
- Sin paginación.
- Detalle en `components/solicitudes/TaskModal.tsx`, con cabecera verde-oliva `#b5b801`.
- Botón de recarga manual.

Observaciones:

- Dos tablas y dos modales distintos dentro de la misma ruta.
- Los controles de fecha están comentados, pero la lógica y el rango por defecto siguen activos.
- La bandeja usa `min-width: 1100px` y no tiene modo tarjeta.
- “Limpiar” y estados de error/carga no son consistentes con Tareas.

### 5.3 Mis solicitudes --- `/mfpages/cliente/mis-solicitudes`

- Propósito: seguimiento del cliente y creación de solicitudes.
- Tabla `SharedTable` con Fecha, Solicitud, Estado, Progreso y Acción.
- Paginación de 10.
- Filtros: estado, fecha, rango, búsqueda y limpiar.
- Botón “+ Nueva solicitud” índigo `#3128bb`.
- Modal de creación reutiliza `TaskModalDesarrollo.module.css`.
- Detalle en modal con tabs Detalle/Historial.
- Pantalla de éxito con tarjeta de `380px`.
- Observaciones: el selector de estado no incluye “TODOS” aunque el filtro puede quedar en ese valor; “Limpiar” nace visible; hay otra variante visual en la ruta `respaldo`.

### 5.4 Administración --- `/mfpages/admin`

- Tabs: Usuarios, Roles, Campañas y Permisos.
- Tarjetas con inputs, tablas y modales compartidos.
- Tablas con cabecera oscura `#0d0e0e`, única en la aplicación.
- Botón primario `#111827`.
- Badges de usuarios y roles con colores propios.
- Permisos usa `CampanaAccordion` y checkboxes.
- Observaciones:
  - `admin/page.tsx` referencia `styles.header`, `styles.message` y `styles.tabContent`, que no existen en `Admin.module.css`.
  - `Admin.module.css` y `AdminSections.module.css` están duplicados y divergen en chips, enlaces, badges y errores.
  - Hay acordeones con dos implementaciones distintas.
  - Mensajes globales sin distinción éxito/error.

### 5.5 Equipos --- `/mfpages/equipos`

- Tarjetas expandibles de equipo con cabecera dinámica según rol.
- Tabla de integrantes, gestión de disponibilidad, sub-líderes y reasignaciones.
- Cinco modales hechos a mano con estilos inline.
- Observaciones:
  - Es la pantalla con más estilos inline.
  - No reutiliza `Modal`, `Switch`, `IconButton` ni `Pagination`.
  - Los overlays usan z-index `50/60`, por debajo del shell y de los modales compartidos.
  - No hay búsqueda global ni paginación.
  - El filtro `filtroTipo` existe pero no tiene control visible.

### 5.6 Tareas en desarrollo --- `/mfpages/tareas`

- Cabecera con eyebrow, título, subtítulo y contador.
- Filtros en tarjeta gris: campaña/subcampaña, estado, campo de fecha, rango, búsqueda y limpiar.
- Tabla con Fecha solicitud, Solicitud, Equipo, Estado, Entrega/tiempo y Progreso.
- Filas clickeables que navegan a `/mfpages/tareas/[id]`.
- Paginación de 10; orden por fecha de creación descendente.
- Excluye solicitudes `EN_ESPERA`.
- Carga con skeletons, error con reintento y vacío con panel.
- Filtros persistidos en `sessionStorage`.
- Observaciones: es la pantalla visualmente más moderna; sus tokens no se comparten con el resto.

### 5.7 Detalle de tarea --- `/mfpages/tareas/[id]`

- Enlace de vuelta.
- Cabecera índigo `#3326b9` con ticket, estado, asunto, entrega general, temporizador y, si aplica, “Iniciar tarea”.
- Badge “Solo lectura” para admin.
- Grid de Resumen y Descripción + adjuntos.
- Sección “Trabajo de la solicitud” con progreso y tabs.
- Tabs:
  - Tablero.
  - Asignaciones, si el usuario puede operar.
  - Historial.
- Tablero de tres columnas: En espera, En desarrollo y Solucionado.
- Stand-by no tiene columna: la tarjeta permanece en la columna donde estaba y conserva el badge.
- La columna de una subtarea en Stand-by se deriva de `fecha_inicio`.
- Tarjeta de subtarea con código, menú `⋮`, asa `⠿`, estado, asignado, bloqueos, dependencias, motivo de pausa y selector “Mover a…” en móvil.
- Drag & drop con `@dnd-kit/core`.
- Detalle con estados de ID inválido, carga, error y vacío.

### 5.8 Iniciar tarea --- `/mfpages/tareas/[id]/iniciar`

- Página dedicada, no modal.
- Solo disponible para tareas `APROBADO`, sin subtareas y con permiso.
- Formulario con fechas, miembros, subtareas, pesos y dependencias.
- Validación de ciclos en frontend.
- Al guardar vuelve al detalle.
- Reutiliza `TaskIniciarForm`; el modal legacy sigue disponible para Centro de solicitudes.

---

## 6. Componentes compartidos

| Componente | Uso actual | Estado |
|---|---|---|
| `Modal` | Admin y `SubtaskActionDialog` | `role="dialog"`, Escape; sin focus trap, foco inicial ni scroll lock |
| `Toast` | Varias pantallas | Sin `aria-live` ni cierre manual |
| `Pagination` | Tablas y secciones admin | Estilos inline; sin `type="button"` |
| `SearchableSelect` | Roles y campañas | Teclado sí; sin semántica `combobox/listbox` |
| `Switch` | Perfil y Admin | `role="switch"` y `aria-checked` |
| `IconButton` | Tablas y asignaciones | SVG propios; sin foco visible |
| `RefreshButton` | Solicitudes, Equipos, Historial | Spinner y `aria-busy` |
| `TaskStatusBadge` | Tareas | Mapa de estado unificado solo para esta pantalla |

No existe un componente compartido de `Button`, `Input`, `Badge`, `Table`, `EmptyState`, `ConfirmDialog` o `Spinner`.

---

## 7. Patrones actuales

### 7.1 Tablas

- `SharedTable`: tabla semántica responsive, usada por Admin y Cliente.
- `TaskTableEnDesarrollo`: tabla semántica propia, tarjetas en `≤780px`.
- `TasksTableSolicitudes`: grid de `div`, sin responsive.
- Tablas admin: cabecera oscura, scroll horizontal, sin tarjetas.
- Tablas de subtareas: tabla propia con `data-label` y modo tarjeta.
- Tablas de equipos: tabla inline sin patrón responsive compartido.

### 7.2 Modales

Familias actuales:

1. `Modal` compartido.
2. `tareas/TaskModal`.
3. `solicitudes/TaskModal`.
4. `CrearSolicitudModal`.
5. `TaskDetailClienteModal`.
6. Modales inline de Equipos.
7. Pantallas de éxito y reanudación con overlay propio.

Headers usados: blanco, `#3128bb`, `#3326b9`, `#b5b801` y sin header.

### 7.3 Badges de estado

Existen al menos siete mapas distintos para los mismos estados:

- `TaskStatusBadge`.
- `AdminSolicitudesTable`.
- `ClienteSolicitudesTable`.
- `TaskDetailClienteModal`.
- Página de respaldo.
- Modal de solicitudes.
- Badges inline de Equipos.

Los colores, mayúsculas y bordes cambian entre pantallas.

### 7.4 Loading, error y vacío

- Tareas y detalle: skeletons, `role="alert"` y reintento.
- Solicitudes y Mis solicitudes: texto plano, sin reintento.
- Admin: texto “Cargando…” y mensajes globales sin `role="alert"`.
- Equipos: texto/caja roja inline.
- Historial: loading, error y vacío propios.
- No hay `loading.tsx`, `error.tsx` ni `not-found.tsx` globales.

---

## 8. Responsive consolidado

Breakpoints reales:

`1100`, `1050`, `992`, `900`, `860`, `780`, `768`, `700`, `640`, `600`, `480`, `420`.

| Breakpoint | Cambios principales |
|---|---|
| `1100px` | SharedTable reduce ancho; tablero de detalle a 2 columnas |
| `1050px` | Tabla de Tareas oculta Equipo |
| `992px` | Shell reduce padding y título |
| `900px` | Filtros de Tareas a 3 columnas; formulario de inicio reorganizado |
| `860px` | Resumen/descripción del detalle a 1 columna |
| `780px` | Tabla de Tareas pasa a tarjetas |
| `768px` | Shell y mayoría de pantallas pasan a móvil; SharedTable a tarjetas |
| `700px` | Modal de solicitudes a 1 columna |
| `640px` | Filtros de Tareas a 2 columnas |
| `600px` | Formulario de inicio a 1 columna |
| `480px` | Ajustes finales de tablas, modales y botones |
| `420px` | Filtros de Tareas a 1 columna |

No hay una escala común ni container queries. El contenido no tiene ancho máximo.

---

## 9. Accesibilidad actual

Implementado:

- `html lang="es"`.
- Landmarks principales.
- Sidebar con foco, Escape, restauración y scroll bloqueado.
- Tabs del detalle con `role`, `aria-selected`, flechas y Home/End.
- Progressbars con `aria-valuemin/max/now`.
- Filas clicables con teclado.
- Menú de subtarea con `aria-haspopup`, `aria-expanded` y `role="menu"`.
- `role="alert"` en errores de Tareas, Detalle, Iniciar y diálogos.
- `prefers-reduced-motion` en sidebar, skeletons, tablero y refresh.

Faltante:

- Focus trap, foco inicial y restauración en modales personalizados.
- `aria-live` en Toast.
- `aria-current="page"` en el sidebar.
- Semántica completa en `SearchableSelect`.
- `aria-invalid` y `aria-describedby` en formularios.
- Foco visible en varios botones, paginación, modales y admin.
- Cierre con Escape en la mayoría de modales legacy.
- Reduced motion en animaciones de éxito, switch y acordeones.
- Skip link y gestión de foco al cambiar de ruta.
- Jerarquía de encabezados uniforme.

---

## 10. Observaciones y deuda visual priorizada

### Prioridad alta

- Persisten varias familias de modales con overlays, z-index y semántica distintos.
- Se mantienen varios lenguajes de tabla para datos similares.
- Algunos componentes conservan mapas de estado propios en lugar de `TaskStatusBadge`.
- Duplicación y divergencia entre `Admin.module.css` y `AdminSections.module.css`.
- Clases inexistentes en `Admin.module.css` para header, mensaje y contenido de tabs.
- Modales de Equipos sin semántica, Escape ni foco.
- Toasts sin cierre manual ni pausa.
- Breakpoints inconsistentes (`780` vs `768`, `1050` vs `1100`).

### Prioridad media

- `TaskModalDesarrollo.module.css` concentra cerca de 2.000 líneas y múltiples componentes.
- Estilos inline extendidos, especialmente en Equipos.
- Estados de carga/error/empty desiguales.
- La tabla de la bandeja no es responsive.
- El sidebar no tiene estado persistente de escritorio.
- No hay ancho máximo de contenido.

### Prioridad baja

- Código muerto: `TaskStateSection`, selectores sin uso, página de respaldo.
- Mezcla de iconos SVG, glifos Unicode y emojis.
- Duplicación de estilos de éxito entre `SolicitudGenerada` y `TaskModalSolicitudes`.
- Jerarquía de encabezados inconsistente.
- Falta de metadata por página.

---

## 11. Checklist del estado actual

- [x] Sidebar drawer con overlay y cierre por teclado.
- [x] Tokens globales de color, radios y espaciado en `app/globals.css`.
- [x] Login con Microsoft.
- [x] Perfil con acordeones y preferencias.
- [x] Bandeja de solicitudes y centro de admin.
- [x] Mis solicitudes con creación y detalle.
- [x] Administración de usuarios, roles, campañas y permisos.
- [x] Equipos con gestión de integrantes y disponibilidad.
- [x] Listado de Tareas con filtros y persistencia.
- [x] Tabla de Tareas responsive.
- [x] Detalle de tarea como página.
- [x] Iniciar tarea como página.
- [x] Tablero de tres columnas.
- [x] Stand-by sin columna propia.
- [x] Menú de subtarea y selector móvil.
- [x] Drag & drop con teclado, mouse y touch.
- [x] Diálogos de pausa, solución y reanudación.
- [x] Asignaciones, dependencias e historial.
- [x] Modo solo lectura para admin en Tareas.

---

## 12. Fuera de alcance

- No se documenta como implementado nada que no exista en el código.
- No se proponen aquí cambios de negocio ni de backend.
- No se incluyen secretos, credenciales ni configuración de correo.
- No se reemplaza la especificación funcional de `DESIGN.md`.
- No se corrigen en este documento las inconsistencias detectadas.

---

## 13. Referencias principales

### Shell

- `app/layout.tsx`
- `app/globals.css`
- `app/page.tsx`
- `app/mfpages/layout.tsx`
- `components/DashboardLayout.tsx`
- `components/DashboardLayout.css`
- `components/Sidebar.tsx`
- `components/Sidebar.css`
- `components/GuardRuta.tsx`

### Pantallas

- `app/mfpages/perfil/page.tsx`
- `app/mfpages/perfil/Perfil.module.css`
- `app/mfpages/solicitudes/page.tsx`
- `app/mfpages/cliente/mis-solicitudes/page.tsx`
- `app/mfpages/admin/page.tsx`
- `app/mfpages/admin/Admin.module.css`
- `app/mfpages/equipos/page.tsx`
- `app/mfpages/equipos/Equipos.module.css`
- `app/mfpages/tareas/page.tsx`
- `app/mfpages/tareas/Tareas.module.css`
- `app/mfpages/tareas/[id]/page.tsx`
- `app/mfpages/tareas/[id]/iniciar/page.tsx`

### Componentes de tareas

- `components/tareas/TareaDetalle.tsx`
- `components/tareas/TareaDetalle.module.css`
- `components/tareas/SubtaskBoard.tsx`
- `components/tareas/SubtaskCard.tsx`
- `components/tareas/SubtaskActionDialog.tsx`
- `components/tareas/AssignmentPanel.tsx`
- `components/tareas/TaskFilters.tsx`
- `components/tareas/TaskTableEnDesarrollo.tsx`
- `components/tareas/TaskStatusBadge.tsx`
- `components/tareas/TaskIniciarForm.tsx`
- `components/tareas/HistorialTarea.tsx`

### Componentes compartidos

- `components/ui/Modal.tsx`
- `components/ui/Modal.module.css`
- `components/ui/Toast.tsx`
- `components/ui/Pagination.tsx`
- `components/ui/SearchableSelect.tsx`
- `components/ui/Switch.tsx`
- `components/ui/IconButton.tsx`
- `components/ui/RefreshButton.tsx`
