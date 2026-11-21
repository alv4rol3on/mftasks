
import IniciarTareaPage from "@/components/tareas/IniciarTareaPage";
import { obtenerTareaId } from "@/lib/tareaUrl";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tareaId = obtenerTareaId(id);

  return (
    <IniciarTareaPage
      tareaId={tareaId}
      rutaTarea={id}
    />
  );
}
