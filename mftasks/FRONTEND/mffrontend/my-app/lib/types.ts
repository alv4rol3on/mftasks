export interface Subtarea {
    id: number;
    tarea: number;
    descripcion: string;
    asignado: number;
    asignado_nombre: string;
    estado: string;
    peso: number;
    fecha_creacion: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
}

export interface Task {
    id: number;
    asunto: string;
    descripcion: string;
    cliente: number;
    cliente_nombre: string;
    equipo: number;
    equipo_nombre: string;
    aprobador: number | null;
    aprobador_nombre: string | null;
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

export interface EquipoMiembro {
    id: number;
    email: string;
    nombres: string;
    apellidos: string;
}

export interface EquipoInfo {
    id: number;
    nombre: string;
    lider: EquipoMiembro | null;
    activo: boolean;
    miembros: EquipoMiembro[];
}