"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getUsuarioActual } from "@/lib/auth";
import type { EquipoInfo } from "@/lib/types";

export function useTareasGuard() {
  const router = useRouter();
  const [sinPermiso, setSinPermiso] = useState(false);

  useEffect(() => {
    const user = getUsuarioActual();
    if (!user) {
      router.replace("/");
      return;
    }
    const roles = (user.roles ?? []).map((r) => r.toLowerCase());
    const isAdmin = roles.includes("administrador");
    const isCliente = roles.includes("cliente");
    const isMiembro = roles.includes("miembro");
    if (isAdmin) {
      router.replace("/mfpages/solicitudes");
      return;
    }
    if (isCliente && !isMiembro) {
      apiFetch<EquipoInfo[] | { results: EquipoInfo[] }>("/api/usuarios/equipos/")
        .then((data) => {
          const arr = Array.isArray(data) ? data : (data as { results: EquipoInfo[] }).results ?? [];
          const uid = user.id;
          const esMiembro = arr.some((eq) => eq.lider?.id === uid || eq.miembros?.some((m) => m.id_usuario === uid));
          if (!esMiembro) setSinPermiso(true);
        })
        .catch(() => setSinPermiso(true));
    }
  }, [router]);

  return { sinPermiso };
}
