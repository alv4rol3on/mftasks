import { apiFetch } from "./api";
import type { DisponibilidadUsuario } from "./types";

export async function obtenerDisponibilidad(): Promise<DisponibilidadUsuario> {
  return apiFetch<DisponibilidadUsuario>("/api/usuarios/me/disponibilidad/");
}

export async function guardarDisponibilidad(
  data: DisponibilidadUsuario
): Promise<DisponibilidadUsuario> {
  return apiFetch<DisponibilidadUsuario>("/api/usuarios/me/disponibilidad/", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
