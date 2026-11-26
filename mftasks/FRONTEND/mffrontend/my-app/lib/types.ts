export interface SubtareaPendiente {
    id: number;
    codigo?: string | null;
    descripcion: string;
    estado: string;
    tarea_id: number;
    tarea_ticket?: string | null;
    tarea_asunto: string;
}

export interface EquipoSinSublider {
    id: number;
    nombre: string;
}

export interface DisponibilidadUsuario {
    estado: "DISPONIBLE" | "INDISPONIBLE";
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    motivo?: string;
    fecha_actualizacion?: string;
    subtareas_pendientes?: SubtareaPendiente[];
    equipos_sin_sublider?: EquipoSinSublider[];
    equipos_sin_cobertura?: EquipoSinSublider[];
}

export interface Subtarea {
    id: number;
    codigo?: string | null;
    tarea: number;
    descripcion: string;
    asignado: number;
    asignado_nombre: string;
    estado: "EN_ESPERA" | "EN_DESARROLLO" | "SOLUCIONADO" | "STAND_BY" | string;
    peso: number;
    fecha_creacion: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    motivo_standby?: string | null;
    fecha_standby?: string | null;
    fecha_fin_standby?: string | null;
    standby_por?: number | null;
    bloqueada_por?: { id: number; codigo?: string | null; estado: string; descripcion: string }[];
    dependencias?: number[];
    tiempo_tomado_segundos?: number | null;
    tiempo_tomado_horas?: number | null;
    tiempo_tomado_formateado?: string | null;
    activo?: boolean;
    fecha_inactivacion?: string | null;
    inactivada_por?: number | null;
}

export interface ArchivoTarea {
    id: number;
    nombre: string;
    url: string;
}

export interface AprobacionTarea {
    id: number;
    nivel: string;
    accion: "APROBADO" | "RECHAZADO" | string;
    usuario: number | null;
    usuario_nombre: string | null;
    motivo: string;
    fecha: string;
}

export interface TipoSolicitudCatalogo {
    codigo: string;
    nombre: string;
    descripcion?: string;
    orden: number;
    requiere_detalle: boolean;
    activo: boolean;
}

export interface PrioridadCatalogo {
    codigo: string;
    nombre: string;
    orden: number;
    color?: string;
    activo: boolean;
}

export interface Task {
    id: number;
    ticket?: string | null;
    asunto: string;
    tipo_solicitud?: string;
    detalle_tipo_solicitud?: string;
    descripcion: string;
    cliente: number;
    cliente_nombre: string;
    entidad?: number | null;
    entidad_nombre?: string | null;
    equipo: number;
    equipo_nombre: string;
    subcampana?: number | null;
    subcampana_nombre?: string | null;
    campana_nombre?: string | null;
    aprobador: number | null;
    aprobador_nombre: string | null;
    solicitante: number | null;
    solicitante_nombre: string | null;
    estado: string;
    paso_aprobacion?: string | null;
    paso_aprobacion_nombre?: string | null;
    aprobaciones?: AprobacionTarea[];
    puedo_aprobar?: boolean;
    auto_aprobada?: boolean;
    puede_triar?: boolean;
    prioridad?: string | null;
    puede_cancelar?: boolean;
    puede_agregar_informacion?: boolean;
    puede_confirmar_solucion?: boolean;
    puede_reabrir?: boolean;
    puedo_resolver_reapertura?: boolean;
    estado_explicado?: string;
    siguiente_paso?: string;
    motivo_demora?: string | null;
    equipo_lider_nombre?: string;
    confirmacion_cliente?: "PENDIENTE" | "CONFIRMADA" | "REABIERTA" | null;
    fecha_limite_confirmacion?: string | null;
    fecha_confirmacion_cliente?: string | null;
    reaperturas_cliente?: number;
    fecha_ultima_reapertura?: string | null;
    motivo_reapertura?: string | null;
    fecha_solicitud_reapertura?: string | null;
    plazo_reapertura_dias?: number | null;
    motivo_rechazo_reapertura?: string | null;
    fecha_limite_aprobacion?: string | null;
    motivo_rechazo: string;
    motivo_cancelacion?: string | null;
    motivo_standby?: string | null;
    fecha_standby?: string | null;
    fecha_fin_standby?: string | null;
    standby_por?: number | null;
    fecha_solucion?: string | null;
    fecha_creacion: string;
    fecha_respuesta: string | null;
    fecha_inicio: string | null;
    fecha_entrega_aproximada: string | null;
    incluye_sabado?: boolean;
    progreso: string;
    subtareas: Subtarea[];
    puedo_operar: boolean;
    tiempo_tomado_segundos?: number | null;
    tiempo_tomado_horas?: number | null;
    tiempo_tomado_formateado?: string | null;
    tiempo_planificado_segundos?: number | null;
    fuera_de_tiempo?: boolean | null;
    activo?: boolean;
    fecha_inactivacion?: string | null;
    inactivada_por?: number | null;
    archivos?: ArchivoTarea[];
}

export interface CampanaInfo {
    id: number;
    entidad: number;
    entidad_nombre?: string;
    cliente?: number;
    cliente_nombre?: string;
    nombre: string;
    codigo: string;
    activo: boolean;
    eliminado?: boolean;
    fecha_eliminacion?: string | null;
    subcampanas?: SubCampanaInfo[];
}

export interface SubCampanaInfo {
    id: number;
    entidad?: number;
    entidad_nombre?: string;
    campana: number;
    campana_nombre?: string;
    nombre: string;
    codigo: string;
    activo: boolean;
    eliminado?: boolean;
    fecha_eliminacion?: string | null;
}

export interface CampanaPermitida {
    id: number;
    entidad?: number;
    entidad_nombre?: string;
    nombre: string;
    codigo: string;
    activo: boolean;
    eliminado?: boolean;
    subcampanas: SubCampanaInfo[];
}

export interface EntidadInfo {
    id: number;
    nombre: string;
    razon_social?: string;
    ruc?: string | null;
    correo?: string;
    telefono?: string;
    direccion?: string;
    activo: boolean;
    eliminado?: boolean;
    fecha_eliminacion?: string | null;
    fecha_creacion?: string;
}

export interface ResumenCliente {
    tipo: "cliente";
    en_espera: number;
    aprobadas: number;
    en_desarrollo: number;
    rechazadas: number;
    solucionadas: number;
    total: number;
}

export interface TareaConPendientes {
    tarea_id: number;
    asunto: string;
    equipo_nombre: string;
    estado_tarea: string;
    subtareas: { subtarea_id: number; descripcion: string; estado: string; peso: number }[];
}

export interface ResumenGestor {
    tipo: "gestor";
    por_aprobar?: number;
    pendientes?: number;
    tareas_pendientes?: number;
    tareas_con_pendientes?: TareaConPendientes[];
}

export interface ResumenAsistente {
    tipo: "asistente";
    pendientes: number;
    tareas_pendientes: number;
    tareas_con_pendientes?: TareaConPendientes[];
}

export interface ResumenAdmin {
    tipo: "admin";
    por_aprobar?: number;
    pendientes?: number;
    tareas_pendientes?: number;
    tareas_con_pendientes?: TareaConPendientes[];
}

export interface ClienteInfo {
    id: number;
    nombre: string;
    razon_social?: string;
    ruc?: string | null;
    activo: boolean;
}

export interface EquipoMiembro {
    id: number;
    codigo?: string | null;
    email?: string;
    nombres: string;
    apellidos: string;
    cargo?: string;
}

export interface EquipoMiembroCliente {
    id: number;
    usuario: {
        nombres: string;
        apellidos: string;
    };
    rol_en_equipo: "LIDER" | "MIEMBRO" | "SUB_LIDER";
    estado: "ACTIVO" | "INACTIVO";
}

// Detalle enriquecido que devuelve el backend para cada miembro
export interface EquipoMiembroDetallado {
    id: number;

    // Datos del formato que recibe el cliente
    usuario?: {
        nombres: string;
        apellidos: string;
    };

    // Datos del formato que reciben administradores y líderes
    id_usuario?: number;
    email?: string;
    nombres?: string;
    apellidos?: string;
    cargo?: string;

    rol_en_equipo: "LIDER" | "MIEMBRO" | "SUB_LIDER";
    estado: "ACTIVO" | "INACTIVO";

    disponibilidad?: DisponibilidadUsuario | null;
    fecha_ingreso?: string;
}

export interface UsuarioListItem {
    id: number;
    email: string;
    nombres: string;
    apellidos: string;
    cargo?: string;
    tipo_usuario?: "COLABORADOR" | "ADMINISTRADOR";
    nivel?: number | null;
    nivel_nombre?: string | null;
    puede_crear_solicitudes?: boolean;
    is_active: boolean;
    activo?: boolean; // alias compat
}

export interface NivelInfo {
    id: number;
    nombre: string;
    descripcion?: string;
    activo: boolean;
    es_sistema?: boolean;
    superior: number | null;
    puede_liderar: boolean;
    auto_aprobar: boolean;
    puede_crear_solicitudes: boolean;
    color?: string | null;
    usuarios_count?: number;
}

export interface EquipoInfo {
    id: number;
    nombre: string;
    lider: EquipoMiembro | null;
    nivel?: number | null;
    nivel_nombre?: string | null;
    nivel_color?: string | null;
    niveles_integrantes_requeridos?: string[];
    activo: boolean;
    fecha_creacion?: string;
    miembros: EquipoMiembroDetallado[]; miembros_count?: number;
    puedo_gestionar?: boolean;
    mi_rol_en_equipo?: string | null;
    mi_estado?: string | null;
}