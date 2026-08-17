import TaskTableSolicitudes from "@/components/solicitudes/TaskTableSolicitudes";

type Task = {
  id: number;
  asunto: string;
  descripcion: string;
  cliente: string;
  estado: string;
  fecha_solicitud: string;
  fecha_inicio: string;
  fecha_fin_aproximada: string;
};

async function getTasks(): Promise<Task[]> {
  const res = await fetch("http://backend:8000/api/tasks/tasks/", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Error al cargar las tareas");
  }

  return res.json();
}

export default async function SolicitudesPage() {
  const tareas = await getTasks();

  const tareasPendientes = tareas.filter(
    (tarea) => tarea.estado === "EN_ESPERA"
  );

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium">
        Solicitudes recibidas
      </h2>

      <TaskTableSolicitudes tareas={tareasPendientes} />
    </div>
  );
}