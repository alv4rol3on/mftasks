import { apiFetch } from "./api";

export interface PreferenciasNotificacion {
  recibir_correos: boolean;
  cliente_solicitud_creada: boolean;
  cliente_solicitud_resuelta: boolean;
  cliente_solicitud_standby: boolean;
  cliente_solicitud_solucionada: boolean;
  equipo_nueva_solicitud: boolean;
  equipo_pendiente_revision: boolean;
  equipo_alerta_diaria: boolean;
  fecha_actualizacion?: string;
}

export function obtenerPreferenciasNotificacion(): Promise<PreferenciasNotificacion> {
  return apiFetch<PreferenciasNotificacion>("/api/usuarios/notificaciones/");
}

export function guardarPreferenciasNotificacion(
  cambios: Partial<PreferenciasNotificacion>
): Promise<PreferenciasNotificacion> {
  return apiFetch<PreferenciasNotificacion>("/api/usuarios/notificaciones/", {
    method: "PATCH",
    body: JSON.stringify(cambios),
  });
}
