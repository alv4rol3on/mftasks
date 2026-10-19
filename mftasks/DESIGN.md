# Design System --- MF Tasks

## 1. Objetivo

Modernizar la pestaña **Tareas en desarrollo** con patrones de
usabilidad de herramientas ágiles como Jira, manteniendo la identidad
visual y, sobre todo, la lógica de negocio existente. Jira es una
referencia de organización, no una copia exacta.

**Regla principal:** antes de cambiar código, revisar y reutilizar
modelos, endpoints, permisos, transiciones de estado, temporizadores,
notificaciones y reglas de aprobación actuales. Este documento no
autoriza a reescribir esas reglas.

## 2. Identidad visual compartida

Mantener la navegación lateral oscura, la cabecera corporativa roja, el
saludo del usuario, su código y el botón de cierre de sesión. No crear
una navegación global diferente para Tareas en desarrollo.

Colores aproximados de referencia:

  Uso                               Color
  --------------------------------- -----------
  Cabecera corporativa              `#C8210A`
  Fondo de navegación               `#242424`
  Opción activa                     `#515151`
  Fondo de página                   `#FFFFFF`
  Paneles                           `#F2F3F5`
  Bordes y divisores                `#E0E3E8`
  Texto principal                   `#101828`
  Texto secundario                  `#64748B`
  Cabecera del detalle              `#3326B9`
  En espera                         `#B7791F`
  En desarrollo                     `#1769AA`
  Stand-by / pausa                  `#667085`
  Solucionado                       `#25855A`
  Bloqueada (indicador adicional)   `#F1F2F4`

Los colores son aproximados y deben adaptarse a las variables CSS ya
existentes. No comunicar estados únicamente mediante color.

Usar la tipografía sans serif que ya tenga el proyecto. Si no existe una
definida, usar `Arial, Helvetica, sans-serif`. Como guía: títulos de
página de 16--20 px, títulos de panel de 13--15 px, texto general de
12--14 px y metadatos de 11--12 px.

## 3. Pestaña «Tareas en desarrollo»

### Encabezado y filtros

Mostrar el título de la página, la cantidad de resultados y los filtros
existentes. Mantener su funcionalidad y los campos disponibles en el
proyecto: campaña, subcampaña, estado, equipo, fecha o búsqueda por
texto, según corresponda. Incluir la acción para limpiar filtros.

En escritorio, los filtros pueden ocupar una o dos filas. En pantallas
estrechas deben reorganizarse sin provocar scroll horizontal de toda la
página.

### Tabla de solicitudes

Usar una tabla compacta y legible, inspirada en listados de incidencias
ágiles. Mantener las columnas y acciones actuales. Según los datos
disponibles, se pueden mostrar fecha de solicitud, código/asunto,
campaña, equipo o responsable, estado general, fecha de entrega general
y progreso de subtareas.

No inventar campos que el backend no entregue. La fila debe permitir
abrir el detalle de la solicitud. Diferenciar claramente el estado
general de la solicitud de los estados de sus subtareas.

## 4. Detalle de solicitud

El detalle puede ser un modal amplio o un panel lateral grande, según la
arquitectura actual. Debe aprovechar mejor el espacio, evitar zonas
vacías y permitir desplazamiento interno cuando haya muchas subtareas o
eventos.

### Cabecera

Mostrar código, asunto, estado general, fecha de entrega general y el
temporizador o tiempo restante si ya lo calcula el sistema. Mantener una
acción clara para cerrar el detalle. El acento violeta/azul oscuro puede
distinguir esta zona, sin sustituir la identidad corporativa global.

### Resumen y descripción

En escritorio, distribuir dos paneles: - **Resumen:** solicitante,
campaña, subcampaña, equipo, fecha de solicitud y metadatos
existentes. - **Descripción:** descripción completa de la solicitud.

En móvil, apilar los paneles. No truncar contenido importante sin
permitir consultarlo completo.

### Pestañas internas

Incluir como mínimo: - **Progreso:** lista o tabla de subtareas,
asignaciones, estados y dependencias. - **Historial:** cronología
general de la solicitud y sus subtareas.

Cambiar de pestaña no debe descartar silenciosamente cambios pendientes.

## 5. Subtareas y estados

Las subtareas tienen exactamente estos cuatro estados funcionales:

  Estado             Significado
  ------------------ -----------------------------------
  En espera          Aún no se está trabajando en ella
  En desarrollo      Trabajo activo
  Stand-by (pausa)   Trabajo temporalmente pausado
  Solucionado        Trabajo terminado

Mapear estos nombres a los valores reales del backend. No crear estados
funcionales adicionales ni cambiar las transiciones existentes solo por
razones visuales.

**Bloqueada no es un quinto estado:** es una condición derivada de las
dependencias. La subtarea conserva su estado funcional, pero la interfaz
debe indicar que no se puede iniciar o avanzar mientras la dependencia
siga incumplida.

Cada subtarea debe mostrar identificador, descripción, persona asignada,
estado, indicador de bloqueo, dependencias relevantes y las acciones
permitidas al usuario actual. En escritorio puede usarse una tabla; en
móvil, tarjetas o una lista adaptable.

## 6. Dependencias entre subtareas

Representar las relaciones de forma explícita, por ejemplo:
`Subtarea A → Subtarea C`.

Si C depende de A: - C debe aparecer como bloqueada mientras A no cumpla
la condición de finalización definida por el sistema. - Mostrar un
motivo legible, por ejemplo: **«Bloqueada: primero debes solucionar la
subtarea A»**. - Deshabilitar las acciones que permitirían iniciar o
avanzar C mientras la dependencia siga activa. - Al solucionarse A,
actualizar la condición de bloqueo de C usando las reglas actuales. - Si
una subtarea depende de varias, todas las dependencias requeridas deben
cumplirse.

El backend debe validar las dependencias al cambiar estados. No basta
con deshabilitar controles en el frontend.

Solo los usuarios que ya tengan permiso pueden crear, editar o eliminar
dependencias y modificar asignaciones. Los demás deben ver la
información en modo de solo lectura. Reutilizar los roles y permisos
existentes; no ampliar privilegios por añadir controles nuevos.

El editor de dependencias debe permitir seleccionar subtareas
predecesoras y evitar ciclos, como A depende de C, C de B y B de A. La
prevención de ciclos también debe validarse en el backend.

## 7. Un único temporizador general

Toda la solicitud comparte **un único temporizador y una única fecha de
entrega general**. Las subtareas no tienen plazos ni cronómetros
individuales.

-   Mostrar la fecha límite y, si existe en el sistema, el tiempo
    restante en la cabecera de la solicitud.
-   No añadir fechas límite, cuentas regresivas o cronómetros
    independientes a las subtareas.
-   El cambio autorizado de la fecha de entrega debe actualizar el
    indicador general.
-   Conservar el cálculo actual del tiempo, zona horaria, pausas y
    días/horas laborales.
-   No recalcular tiempos de negocio de forma independiente en el
    frontend.
-   Si no hay fecha de entrega, mostrarlo explícitamente; no inventar un
    tiempo restante.

## 8. Historial general

La pestaña **Historial** debe mostrar la trazabilidad de toda la
solicitud, no solo la de la subtarea seleccionada.

Cuando estos datos existan, mostrar una cronología ordenada por fecha y
hora con: - Usuario que realizó la acción. - Acción realizada. - Entidad
afectada (solicitud o subtarea). - Valor anterior y nuevo, cuando
corresponda y esté disponible. - Comentario o motivo, si el flujo ya lo
registra.

Pueden aparecer eventos como creación, cambios de estado, ajustes de
entrega, cambios de asignación, cambios de dependencias, pausas,
reanudaciones y solución de subtareas, pero solo si el sistema realmente
los registra. No reconstruir ni inventar eventos a partir del estado
actual.

Si algún evento necesario no se almacena, proponerlo como cambio de
backend separado. Distinguir visualmente los eventos de la solicitud y
los de las subtareas. Añadir filtros por usuario o tipo solo si el
volumen de datos lo justifica.

## 9. Preservar las reglas actuales

Esta sección es obligatoria durante la implementación:

1.  Inspeccionar modelos, serializers, vistas, servicios, permisos y
    componentes actuales antes de modificar.
2.  Reutilizar las reglas de roles, aprobación, acceso y asignación ya
    implementadas.
3.  Mantener la jerarquía de roles y la lógica de aprobación vigente; no
    reintroducir reglas anteriores que ya fueron reemplazadas.
4.  No cambiar estados, transiciones, cálculos de tiempo ni fechas para
    acomodarlos al diseño.
5.  La interfaz debe reflejar los permisos del backend; ocultar botones
    no sustituye la autorización del servidor.
6.  Validar en backend transiciones, dependencias, ciclos, asignaciones
    y cambios de permisos.
7.  Conservar notificaciones, tareas programadas y eventos existentes.
8.  Si la interfaz necesita datos que aún no existen, documentarlos como
    cambios funcionales separados.
9.  No eliminar endpoints, campos ni comportamientos sin confirmar que
    son obsoletos.
10. Implementar en pasos pequeños y probar los casos de subtareas
    bloqueadas, cambios de estado, permisos y ajuste de la fecha
    general.

## 10. Componentes reutilizables

Adaptar los nombres a la estructura real y reutilizar equivalentes
existentes: - `Sidebar`, `Topbar`, `PageHeader` - `TaskFilters`,
`TaskTable` - `TaskStatusBadge` - `RequestDetail`, `RequestSummary`,
`RequestDescription` - `RequestTabs` - `SubtaskList` o `SubtaskTable` -
`SubtaskStatusSelect`, `DependencyBadge`, `DependencyEditor` -
`AssigneeSelect` - `RequestTimer` - `RequestHistoryTimeline`

Separar presentación y reglas de negocio. Los componentes deben recibir
datos y acciones desde la arquitectura de estado existente, sin duplicar
lógica del backend.

## 11. Responsive y accesibilidad

**Escritorio:** navegación lateral visible, filtros en la parte
superior, tabla de subtareas y detalle amplio.

**Tablet:** filtros en varias filas, paneles reorganizables y columnas
secundarias simplificadas sin perder la identificación de la solicitud.

**Móvil:** navegación compacta, resumen y descripción apilados,
subtareas en tarjetas y controles sin desbordamiento.

Todos los controles deben ser operables con teclado, tener foco visible
y etiquetas accesibles. El motivo de una acción deshabilitada debe ser
comprensible. Usar atributos semánticos apropiados para diálogos,
pestañas y paneles expandibles.

## 12. Criterios de aceptación

-   [ ] La pantalla tiene una organización moderna inspirada en
    herramientas ágiles y conserva la identidad de MF Tasks.
-   [ ] Los filtros y acciones existentes siguen funcionando.
-   [ ] Las subtareas mantienen los cuatro estados definidos.
-   [ ] Las dependencias bloquean subtareas correctamente y se muestra
    el motivo.
-   [ ] Solo usuarios autorizados pueden editar asignaciones y
    dependencias.
-   [ ] El sistema rechaza dependencias circulares.
-   [ ] La solicitud conserva una sola fecha de entrega y un solo
    temporizador general.
-   [ ] El historial permite consultar los eventos generales realmente
    registrados.
-   [ ] El backend sigue siendo la autoridad para permisos y reglas de
    negocio.
-   [ ] Se conservan las reglas vigentes de roles, aprobación,
    notificaciones y transiciones.
-   [ ] La pantalla se adapta a distintas resoluciones sin
    desbordamientos.

## 13. Instrucción para asistentes de programación

Antes de implementar este diseño, revisa el frontend y backend actuales
de tareas, subtareas, permisos, dependencias, historial y
temporizadores. Identifica qué ya existe, qué puede reutilizarse y qué
falta. Usa este archivo como guía visual y de interacción, no como
autorización para reescribir la lógica de negocio. Conserva la
compatibilidad con los endpoints y datos existentes y prueba
especialmente los bloqueos, las transiciones de estado, los permisos y
el temporizador general.
