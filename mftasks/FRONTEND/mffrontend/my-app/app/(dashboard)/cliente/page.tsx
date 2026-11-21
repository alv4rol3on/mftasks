"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { esAdmin, esCliente } from "@/lib/auth";
import PageLoader from "@/components/ui/PageLoader";

export default function ClienteIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(
      esCliente() && !esAdmin() ? "/cliente/mis-solicitudes" : "/perfil"
    );
  }, [router]);

  return <PageLoader label="Redirigiendo…" />;
}
