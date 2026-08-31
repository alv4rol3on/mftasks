export interface Subtarea {
    id: number;
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
    standby_por?: number | null;
    bloqueada_por?: { id: number; estado: string; descripcion: string }[];
    dependencias?: number[];
}

export interface Task {
    id: number;
    asunto: string;
    descripcion: string;
    cliente: number;
    cliente_nombre: string;
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
    motivo_rechazo: string;
    fecha_creacion: string;
    fecha_respuesta: string | null;
    fecha_inicio: string | null;
    fecha_entrega_aproximada: string | null;
    progreso: string;
    subtareas: Subtarea[];
    puedo_operar: boolean;
}

export interface CampanaInfo {
    id: number;
    cliente: number;
    cliente_nombre?: string;
    nombre: string;
    codigo: string;
    activo: boolean;
    subcampanas?: SubCampanaInfo[];
}

export interface SubCampanaInfo {
    id: number;
    campana: number;
    campana_nombre?: string;
    nombre: string;
    codigo: string;
    activo: boolean;
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

export interface ResumenAsignador {
    tipo: "asignador";
    por_aprobar: number;
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
    por_aprobar: number;
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
    email: string;
    nombres: string;
    apellidos: string;
    cargo?: string;
}

// Detalle enriquecido que devuelve el backend para cada miembro
export interface EquipoMiembroDetallado {
    id: number;
    usuario: EquipoMiembro;
    id_usuario: number;
    email: string;
    nombres: string;
    apellidos: string;
    cargo?: string;
    rol_en_equipo: "LIDER" | "MIEMBRO" | "SUB_LIDER"; // SUB_LIDER deprecado, mapea a MIEMBRO
    estado: "ACTIVO" | "INACTIVO" | "INDISPONIBLE";
    fecha_inicio_indisponibilidad?: string | null;
    fecha_fin_indisponibilidad?: string | null;
    motivo_indisponibilidad?: string;
    fecha_ingreso: string;
}

export interface UsuarioListItem {
    id: number;
    email: string;
    nombres: string;
    apellidos: string;
    cargo?: string;
    is_active: boolean;
    activo?: boolean; // alias compat
}

export interface EquipoInfo {
    id: number;
    nombre: string;
    lider: EquipoMiembro | null;
    activo: boolean;
    fecha_creacion?: string;
    miembros: EquipoMiembroDetallado[];
    puedo_gestionar?: boolean;
    mi_rol_en_equipo?: string | null;
    mi_estado?: string | null;
}