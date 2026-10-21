"use client";

import styles from "./TaskStatusBadge.module.css";

type EstadoInfo = {
    label: string;
    icon: string;
    tone: "espera" | "desarrollo" | "pausa" | "solucionado" | "aprobado" | "rechazado" | "neutro";
};

const ESTADOS: Record<string, EstadoInfo> = {
    EN_ESPERA: { label: "En espera", icon: "◷", tone: "espera" },
    EN_DESARROLLO: { label: "En desarrollo", icon: "▶", tone: "desarrollo" },
    STAND_BY: { label: "Stand-by", icon: "Ⅱ", tone: "pausa" },
    SOLUCIONADO: { label: "Solucionado", icon: "✓", tone: "solucionado" },
    APROBADO: { label: "Aprobado", icon: "✓", tone: "aprobado" },
    RECHAZADO: { label: "Rechazado", icon: "✕", tone: "rechazado" },
    CANCELADO: { label: "Cancelada", icon: "×", tone: "neutro" },
    INACTIVO: { label: "Inactiva", icon: "○", tone: "neutro" },
};

export function obtenerEstadoInfo(estado: string, fueraDeTiempo = false): EstadoInfo {
    if (fueraDeTiempo && estado === "EN_DESARROLLO") {
        return { label: "Fuera de tiempo", icon: "⚠", tone: "rechazado" };
    }

    return ESTADOS[estado] ?? {
        label: estado ? estado.replaceAll("_", " ").toLowerCase() : "Sin estado",
        icon: "•",
        tone: "neutro",
    };
}

type Props = {
    estado: string;
    fueraDeTiempo?: boolean;
    compact?: boolean;
    className?: string;
};

export default function TaskStatusBadge({ estado, fueraDeTiempo, compact, className }: Props) {
    const info = obtenerEstadoInfo(estado, fueraDeTiempo);

    return (
        <span
            className={[
                styles.badge,
                styles[info.tone],
                compact ? styles.compact : "",
                className ?? "",
            ].filter(Boolean).join(" ")}
        >
            <span className={styles.icon} aria-hidden="true">{info.icon}</span>
            {info.label}
        </span>
    );
}
