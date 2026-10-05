"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCapacidades } from "./CapacidadesProvider";
import { rutaPermitida } from "@/lib/capacidades";

/**
 * Redirige a /mfpages/perfil cuando el usuario autenticado intenta entrar a una
 * ruta que no le corresponde. Mientras se resuelven las capacidades no redirige
 * para evitar falsos positivos.
 */
export default function GuardRuta({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { caps, cargando, autenticado } = useCapacidades();

  const permitido = rutaPermitida(pathname, caps);

  useEffect(() => {
    if (cargando || !autenticado) return;
    if (!permitido) {
      router.replace("/mfpages/perfil");
    }
  }, [cargando, autenticado, permitido, router]);

  if (cargando || !autenticado) return null;
  if (!permitido) return null;

  return <>{children}</>;
}
