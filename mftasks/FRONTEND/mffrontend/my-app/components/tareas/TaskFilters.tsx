"use client";

import FiltroCampanaSubcampana from "@/components/filtros/FiltroCampanaSubcampana";
import { ESTADOS_TAREA } from "@/app/mfpages/tareas/utils/tareasFilters";
import type { CampoFecha, EstadoFiltro } from "@/lib/services/tareasService";
import styles from "./TaskFilters.module.css";

type Props = {
    entidadId?: number | "";
    onEntidadChange?: (entidadId: number | "") => void;
    campanaId: number | "";
    subcampanaId: number | "";
    onCampanaChange: (next: { campanaId: number | ""; subcampanaId: number | "" }) => void;
    estado: EstadoFiltro;
    onEstadoChange: (estado: EstadoFiltro) => void;
    campoFecha: CampoFecha;
    onCampoFechaChange: (campo: CampoFecha) => void;
    desde: string;
    onDesdeChange: (fecha: string) => void;
    hasta: string;
    onHastaChange: (fecha: string) => void;
    busqueda: string;
    onBusquedaChange: (texto: string) => void;
    onBuscar: (e: React.FormEvent) => void;
    onLimpiar: () => void;
    hayFiltros: boolean;
};

const selectStyle: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    height: 36,
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    padding: "0 10px",
    background: "var(--color-background)",
    color: "var(--color-text)",
    fontSize: 13,
};

export default function TaskFilters({
    entidadId,
    onEntidadChange,
    campanaId,
    subcampanaId,
    onCampanaChange,
    estado,
    onEstadoChange,
    campoFecha,
    onCampoFechaChange,
    desde,
    onDesdeChange,
    hasta,
    onHastaChange,
    busqueda,
    onBusquedaChange,
    onBuscar,
    onLimpiar,
    hayFiltros,
}: Props) {
    return (
        <section className={styles.filters} aria-label="Filtros de tareas">
            <div className={`${styles.field} ${styles.campaignField}`}>
                <span className={styles.label}>Entidad, campaña y subcampaña</span>
                <div className={styles.campaignRow}>
                    <FiltroCampanaSubcampana
                        entidadId={entidadId}
                        onEntidadChange={onEntidadChange}
                        campanaId={campanaId}
                        subcampanaId={subcampanaId}
                        onChange={onCampanaChange}
                        selectStyle={selectStyle}
                        selectClassName={styles.control}
                        campanaAriaLabel="Filtrar por campaña"
                        subcampanaAriaLabel="Filtrar por subcampaña"
                    />
                </div>
            </div>

            <label className={`${styles.field} ${styles.shortField}`}>
                <span className={styles.label}>Estado</span>
                <select
                    value={estado}
                    onChange={(e) => onEstadoChange(e.target.value as EstadoFiltro)}
                    className={styles.control}
                    title="Filtrar por estado"
                >
                    {ESTADOS_TAREA.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
            </label>

            <label className={`${styles.field} ${styles.shortField}`}>
                <span className={styles.label}>Fecha de</span>
                <select
                    value={campoFecha}
                    onChange={(e) => onCampoFechaChange(e.target.value as CampoFecha)}
                    className={styles.control}
                    title="Campo de fecha a filtrar"
                >
                    <option value="solicitud">Solicitud</option>
                    <option value="entrega">Entrega</option>
                    <option value="aprobacion">Aprobación</option>
                </select>
            </label>

            <label className={`${styles.field} ${styles.shortField}`}>
                <span className={styles.label}>Desde</span>
                <input
                    type="date"
                    value={desde}
                    max={hasta || undefined}
                    onChange={(e) => onDesdeChange(e.target.value)}
                    className={styles.control}
                />
            </label>

            <label className={`${styles.field} ${styles.shortField}`}>
                <span className={styles.label}>Hasta</span>
                <input
                    type="date"
                    value={hasta}
                    min={desde || undefined}
                    onChange={(e) => onHastaChange(e.target.value)}
                    className={styles.control}
                />
            </label>

            <form className={`${styles.field} ${styles.searchField}`} onSubmit={onBuscar} role="search">
                <label className={styles.label} htmlFor="buscar-tarea">Buscar</label>
                <div className={styles.searchRow}>
                    <input
                        id="buscar-tarea"
                        value={busqueda}
                        onChange={(e) => onBusquedaChange(e.target.value)}
                        placeholder="Ticket, asunto o descripción..."
                        className={styles.control}
                    />
                    <button type="submit" className={styles.searchButton}>Buscar</button>
                </div>
            </form>

            <div className={styles.actions}>
                {hayFiltros && (
                    <button type="button" onClick={onLimpiar} className={styles.clearButton}>
                        Limpiar filtros
                    </button>
                )}
            </div>
        </section>
    );
}
