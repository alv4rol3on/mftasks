# Design System --- MF Tasks

## 1. Objetivo

Toda MF Tasks debe compartir un único sistema visual: navegación oscura,
cabecera roja corporativa, fondos claros, paneles discretos y colores
semánticos para los estados. Aplica a Perfil, Bandeja de solicitudes,
Tareas en desarrollo, Equipos, configuración y futuras pantallas.

La referencia de Jira se aplica a la organización de tareas, subtareas,
dependencias y seguimiento; no implica copiar toda su apariencia ni
modificar la lógica de negocio existente.

## 2. Tokens globales de diseño

Estos tokens son la fuente de verdad para colores, bordes y espaciado.
Si el repositorio ya tiene variables equivalentes, reutilizarlas y
evitar duplicados.

  --------------------------------------------------------------------------
  Token                      Valor                   Uso
  -------------------------- ----------------------- -----------------------
  `--color-brand`            `#C8210A`               Cabecera y acciones
                                                     principales

  `--color-brand-hover`      `#A91F0A`               Hover de acciones
                                                     principales

  `--color-sidebar`          `#242424`               Navegación lateral

  `--color-sidebar-active`   `#515151`               Elemento activo

  `--color-background`       `#FFFFFF`               Fondo principal

  `--color-surface`          `#F2F3F5`               Paneles y superficies
                                                     secundarias

  `--color-border`           `#E0E3E8`               Bordes y divisores

  `--color-text`             `#101828`               Texto principal

  `--color-text-secondary`   `#64748B`               Etiquetas y metadatos

  `--color-badge`            `#292844`               Roles y etiquetas
                                                     compactas

  `--color-detail-header`    `#3326B9`               Cabecera del detalle de
                                                     solicitud

  `--color-waiting`          `#B7791F`               En espera

  `--color-in-progress`      `#1769AA`               En desarrollo

  `--color-paused`           `#667085`               Stand-by

  `--color-done`             `#25855A`               Solucionado

  `--color-disabled`         `#F1F2F4`               Elementos bloqueados o
                                                     deshabilitados
  --------------------------------------------------------------------------

Los valores son aproximaciones basadas en las capturas. Validarlos con
los estilos reales y el manual de marca, si existe.

## 3. Reglas visuales globales

### Estructura

-   Mantener la barra lateral oscura, el logotipo, la opción activa y la
    cabecera roja en todas las páginas autenticadas.
-   Mantener el área de trabajo blanca, con paneles gris claro y bordes
    suaves.
-   Alinear títulos, paneles y controles mediante un espaciado
    consistente.
-   No diseñar cada pantalla como si perteneciera a una aplicación
    diferente.

### Tipografía

-   Reutilizar la fuente ya definida en el proyecto. Si no existe, usar
    `Arial, Helvetica, sans-serif`.
-   Título de página: 16--20 px, semibold o bold.
-   Título de panel: 13--15 px, semibold.
-   Texto principal: 12--14 px.
-   Etiquetas y metadatos: 11--12 px.
-   Priorizar legibilidad y contraste frente a la reproducción exacta de
    una captura.

### Espaciado y formas

-   Usar múltiplos de 4 px: 4, 8, 12, 16, 20 y 24 px.
-   Padding habitual de panel: 14--16 px.
-   Separación entre paneles: 14--16 px.
-   Radio de panel: 10--12 px.
-   Radio de controles: 6--8 px.
-   Evitar sombras fuertes, gradientes decorativos y bordes excesivos.

### Botones

-   **Primario:** rojo corporativo con texto blanco; reservarlo para la
    acción principal.
-   **Secundario:** fondo blanco, borde gris y texto oscuro.
-   **Destructivo:** acción explícita y confirmación cuando corresponda.
-   **Deshabilitado:** apariencia inactiva; si está bloqueado por una
    dependencia, explicar el motivo.
-   Mantener estados hover, focus, disabled y loading coherentes.

### Paneles, tablas y formularios

-   Paneles con `--color-surface`, borde `--color-border` y radio
    uniforme.
-   Tablas con encabezados diferenciados, filas legibles y hover
    discreto.
-   Formularios con alturas, padding, bordes, foco y errores
    consistentes.
-   Modales con jerarquía clara, cierre accesible y desplazamiento
    interno si el contenido es largo.

### Chips y estados

-   Usar chips oscuros para roles, códigos y metadatos compactos.
-   Reservar los colores semánticos para estados y alertas.
-   No depender solo del color: acompañar estados con texto o iconos
    accesibles.
-   «Bloqueada» es una condición derivada de dependencias, no un quinto
    estado de subtarea.

## 4. CSS global

Los tokens pueden declararse en el CSS global de Next.js (por ejemplo,
`globals.css`) y utilizarse desde los CSS Modules. Este es un ejemplo de
referencia; antes de añadirlo, revisar si el proyecto ya tiene variables
equivalentes.

``` css
:root {
  --color-brand: #C8210A;
  --color-brand-hover: #A91F0A;
  --color-sidebar: #242424;
  --color-sidebar-active: #515151;
  --color-background: #FFFFFF;
  --color-surface: #F2F3F5;
  --color-border: #E0E3E8;
  --color-text: #101828;
  --color-text-secondary: #64748B;
  --color-badge: #292844;
  --color-detail-header: #3326B9;

  --color-waiting: #B7791F;
  --color-in-progress: #1769AA;
  --color-paused: #667085;
  --color-done: #25855A;
  --color-disabled: #F1F2F4;

  --radius-panel: 12px;
  --radius-control: 8px;
  --spacing-page: 20px;
}

body {
  background: var(--color-background);
  color: var(--color-text);
  font-family: Arial, Helvetica, sans-serif;
}
```

No pegar este fragmento a ciegas si ya existen tokens, temas o estilos
globales: consolidar los nombres en una sola definición.

## 5. Aplicación por sección

-   **Perfil y configuración:** paneles claros, etiquetas secundarias,
    valores legibles y controles uniformes.
-   **Bandeja de solicitudes:** filtros consistentes, tablas limpias,
    estados semánticos y acciones alineadas.
-   **Tareas en desarrollo:** patrones ágiles para solicitudes,
    subtareas, dependencias e historial.
-   **Equipos y usuarios:** tablas y formularios con los mismos botones,
    paneles y etiquetas.
-   **Modales y paneles de detalle:** mismo lenguaje visual; la cabecera
    puede tener un color de acento específico.

No inventar datos o capacidades que el backend no proporcione para
llenar visualmente una sección.

## 6. Tareas en desarrollo: experiencia tipo Jira

### Listado de solicitudes

-   Mantener los filtros y acciones existentes.
-   Mostrar, según los datos disponibles, fecha de solicitud,
    código/asunto, campaña, equipo o responsable, estado general y fecha
    de entrega general.
-   Permitir abrir el detalle desde cada fila.
-   Diferenciar el estado de la solicitud de los estados de sus
    subtareas.
-   No inventar campos que el backend no entregue.

### Detalle

Organizar el detalle en cabecera, resumen, descripción y navegación
interna. Incluir al menos: - **Progreso:** subtareas, asignaciones,
estados y dependencias. - **Historial:** cronología general de la
solicitud y sus subtareas.

La cabecera puede mostrar código, asunto, estado general, fecha de
entrega y temporizador general, si el sistema ya lo calcula.

### Estados de subtareas

Las subtareas usan exactamente estos cuatro estados funcionales:

  Estado             Significado                     Color
  ------------------ ------------------------------- -----------------------
  En espera          Aún no se trabaja en ella       `--color-waiting`
  En desarrollo      Trabajo activo                  `--color-in-progress`
  Stand-by (pausa)   Trabajo temporalmente pausado   `--color-paused`
  Solucionado        Trabajo terminado               `--color-done`

Mapear las etiquetas a los valores reales del backend. No crear estados
adicionales ni cambiar transiciones para acomodar el diseño.

### Dependencias

-   Mostrar las relaciones de forma explícita, por ejemplo
    `Subtarea A → Subtarea C`.
-   Si C depende de A, indicar que está bloqueada hasta que A cumpla la
    condición de finalización definida por el sistema.
-   Mostrar un motivo legible: «Bloqueada: primero debes solucionar la
    subtarea A».
-   Deshabilitar las acciones que permitan iniciar o avanzar una
    subtarea si la dependencia sigue incumplida.
-   Si existen varias dependencias, cumplir todas las requeridas antes
    de habilitar la subtarea.
-   La validación debe existir en backend, no solo en la interfaz.
-   Evitar dependencias circulares también en backend.

### Asignaciones y permisos

Solo usuarios con los permisos existentes pueden cambiar asignaciones y
crear, modificar o eliminar dependencias. Los demás ven la información
en modo de solo lectura. Reutilizar el sistema actual de roles y
permisos; no ampliar privilegios por añadir controles nuevos.

### Temporizador único

Toda la solicitud tiene **un único temporizador y una única fecha de
entrega general**. Las subtareas no tienen plazos ni cronómetros
individuales. - Mostrar fecha límite y tiempo restante si ya lo calcula
el sistema. - Si se modifica la fecha mediante el flujo autorizado,
actualizar el indicador general. - Conservar la lógica actual de zona
horaria, pausas y cálculo del tiempo. - No recalcular tiempos de negocio
independientemente en el frontend. - Si no hay fecha de entrega,
indicarlo sin inventar una cifra.

### Historial general

La pestaña Historial debe mostrar los eventos de toda la solicitud, no
solo los de una subtarea seleccionada. Cuando esos datos estén
registrados, mostrar fecha/hora, usuario, acción, entidad afectada,
valores anterior/nuevo y comentario si corresponde.

No inventar eventos a partir del estado actual. Si falta registrar algún
evento, documentarlo como una mejora de backend separada.

## 7. Componentes reutilizables

Adaptar los nombres a la estructura real y reutilizar componentes
equivalentes existentes: - `Sidebar`, `Topbar`, `PageHeader` -
`TaskFilters`, `TaskTable`, `TaskStatusBadge` - `RequestDetail`,
`RequestSummary`, `RequestDescription` - `RequestTabs`, `SubtaskList` o
`SubtaskTable` - `SubtaskStatusSelect`, `DependencyBadge`,
`DependencyEditor` - `AssigneeSelect`, `RequestTimer`,
`RequestHistoryTimeline`

Separar presentación y lógica de negocio. No duplicar en el frontend
reglas que ya son responsabilidad del backend.

## 8. Responsive y accesibilidad

-   **Escritorio:** navegación lateral visible, filtros superiores,
    tablas y detalle amplio.
-   **Tablet:** filtros en varias filas y paneles reorganizables.
-   **Móvil:** navegación compacta, paneles apilados y subtareas en
    tarjetas o listas adaptables.
-   Evitar desbordamientos horizontales involuntarios.
-   Todos los controles deben ser operables por teclado y mostrar foco
    visible.
-   Usar etiquetas accesibles para botones, selectores, pestañas,
    diálogos e interruptores.
-   Explicar por qué una acción está deshabilitada.
-   No comunicar estados solo con color.

## 9. Preservación obligatoria de la lógica actual

Antes de modificar el código: 1. Inspeccionar componentes, estilos,
modelos, serializers, vistas, servicios, endpoints y permisos
existentes. 2. Reutilizar las reglas de roles, aprobación, acceso y
asignación ya implementadas. 3. Mantener la jerarquía de roles y la
lógica de aprobación vigente; no reintroducir reglas anteriores que
hayan sido reemplazadas. 4. No cambiar estados, transiciones, cálculos
de tiempo, dependencias o notificaciones solo para acomodar la
apariencia. 5. La interfaz debe reflejar los permisos del backend;
ocultar botones no sustituye la autorización del servidor. 6. Validar en
backend transiciones, dependencias, ciclos y cambios de asignación. 7.
Separar cualquier capacidad funcional nueva de los cambios visuales. 8.
No eliminar endpoints, campos ni comportamientos sin confirmar que son
obsoletos. 9. Implementar en pasos pequeños y probar los flujos
afectados.

## 10. Criterios de aceptación

-   [ ] Todas las páginas comparten navegación, cabecera, tipografía,
    paneles y controles coherentes.
-   [ ] Los tokens de color están centralizados y no duplicados por
    pantalla.
-   [ ] Los filtros y acciones actuales siguen funcionando.
-   [ ] Las subtareas mantienen los cuatro estados definidos.
-   [ ] Las dependencias bloquean correctamente y muestran el motivo.
-   [ ] Solo usuarios autorizados editan asignaciones y dependencias.
-   [ ] Se rechazan dependencias circulares.
-   [ ] La solicitud mantiene un solo temporizador y fecha de entrega
    general.
-   [ ] El historial muestra únicamente eventos realmente registrados.
-   [ ] Se conservan las reglas de roles, aprobación, notificaciones y
    transiciones.
-   [ ] La interfaz es adaptable y accesible.

## 11. Instrucción para asistentes de programación

Antes de implementar, revisa el frontend y backend actuales. Identifica
qué estilos y componentes compartidos existen y consolida los tokens sin
duplicar el sistema. Usa este archivo como guía visual y de interacción,
no como autorización para reescribir la lógica de negocio. Conserva la
compatibilidad con endpoints y datos actuales y prueba especialmente
permisos, dependencias, transiciones y temporizador general.
