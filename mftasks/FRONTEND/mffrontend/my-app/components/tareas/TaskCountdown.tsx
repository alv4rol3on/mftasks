"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface TaskCountdownProps {
    tareaId: number;
}

interface ContadorResponse {
    activo: boolean;
    pausado: boolean;
    finalizado: boolean;
    segundos_restantes: number;
    tiempo_tomado_segundos: number | null;
    fecha_entrega_aproximada: string | null;
    servidor_ahora: string;
}

function formatearTiempo(totalSegundos: number) {
    const segundos = Math.max(0, Math.floor(totalSegundos));

    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segundosRestantes = segundos % 60;

    return `${dias}d ${String(horas).padStart(2, "0")}h ${String(
        minutos
    ).padStart(2, "0")}m ${String(segundosRestantes).padStart(2, "0")}s`;
}

export default function TaskCountdown({
    tareaId,
}: TaskCountdownProps) {
    const [segundos, setSegundos] = useState<number | null>(null);
    const [tiempoTomado, setTiempoTomado] = useState<number | null>(null);
    const [pausado, setPausado] = useState(false);
    const [activo, setActivo] = useState(false);

    useEffect(() => {
        let intervalo: ReturnType<typeof setInterval> | null = null;
        let cancelado = false;

        const cargarContador = async () => {
            try {
                const data = await apiFetch<ContadorResponse>(
                    `/api/tasks/tasks/${tareaId}/contador/`
                );

                if (cancelado) {
                    return;
                }

                setTiempoTomado(data.tiempo_tomado_segundos);
                setPausado(data.pausado);
                setActivo(data.activo);
                setSegundos(data.segundos_restantes);

                /*
                 * Si no está activo, no necesitamos ningún intervalo.
                 */
                if (!data.activo || data.pausado) {
                    return;
                }

                /*
                 * Momento en que Django calculó los segundos.
                 */
                const momentoServidor = new Date(
                    data.servidor_ahora
                ).getTime();

                /*
                 * Momento equivalente en el navegador.
                 */
                const momentoCliente = Date.now();

                /*
                 * Diferencia entre ambos relojes.
                 *
                 * No usamos esta diferencia para modificar el valor,
                 * solamente nos sirve como referencia.
                 */
                const diferenciaRelojes =
                    momentoCliente - momentoServidor;

                /*
                 * Guardamos el valor inicial entregado por Django.
                 */
                const segundosIniciales = data.segundos_restantes;

                /*
                 * Momento exacto del cliente en que recibimos
                 * la respuesta.
                 */
                const referenciaCliente = Date.now();

                intervalo = setInterval(() => {
                    const ahora = Date.now();

                    /*
                     * Cuántos segundos REALES han pasado desde
                     * que recibimos la respuesta.
                     */
                    const segundosTranscurridos = Math.floor(
                        (ahora - referenciaCliente) / 1000
                    );

                    /*
                     * El contador disminuye según el tiempo real.
                     */
                    const nuevoValor = Math.max(
                        0,
                        segundosIniciales - segundosTranscurridos
                    );

                    setSegundos(nuevoValor);
                }, 250);

                console.debug(
                    "Contador sincronizado",
                    {
                        tareaId,
                        segundosIniciales,
                        diferenciaRelojes,
                    }
                );
            } catch (error) {
                console.error(
                    "Error cargando contador:",
                    error
                );
            }
        };

        cargarContador();

        return () => {
            cancelado = true;

            if (intervalo !== null) {
                clearInterval(intervalo);
            }
        };
    }, [tareaId]);

    /*
     * Tarea solucionada:
     * mostramos cuánto tiempo tomó.
     */
    if (tiempoTomado !== null) {
        return (
            <span>
                Tiempo tomado: {formatearTiempo(tiempoTomado)}
            </span>
        );
    }

    /*
     * Tarea pausada.
     */
    if (pausado) {
        return <span>En pausa</span>;
    }

    /*
     * Todavía estamos esperando la respuesta del backend.
     */
    if (segundos === null) {
        return <span>Calculando...</span>;
    }

    /*
     * Tarea activa.
     */
    return (
        <span>
            {formatearTiempo(segundos)}
        </span>
    );
}