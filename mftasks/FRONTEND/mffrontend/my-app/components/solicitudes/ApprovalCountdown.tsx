"use client";

import { useEffect, useState } from "react";

type Props = {
  fechaLimite?: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

function formatearRestante(totalSegundos: number): string {
  const segundos = Math.max(0, Math.floor(totalSegundos));
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const restantes = segundos % 60;

  if (dias > 0) {
    return `${dias}d ${pad(horas)}:${pad(minutos)}:${pad(restantes)}`;
  }

  return `${pad(horas)}:${pad(minutos)}:${pad(restantes)}`;
}

export default function ApprovalCountdown({ fechaLimite }: Props) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const tick = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  if (!fechaLimite) return null;

  const limite = new Date(fechaLimite).getTime();

  if (Number.isNaN(limite)) return null;

  const restanteSegundos = Math.floor((limite - ahora) / 1000);

  if (restanteSegundos <= 0) {
    return (
      <span
        suppressHydrationWarning
        style={{ color: "var(--color-danger)", fontWeight: 700 }}
      >
        Vencida
      </span>
    );
  }

  const color =
    restanteSegundos <= 3600 ? "var(--color-danger)" : "var(--color-text)";

  return (
    <span
      suppressHydrationWarning
      style={{ color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
    >
      {formatearRestante(restanteSegundos)}
    </span>
  );
}
