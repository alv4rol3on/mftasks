import TareaDetalle from "@/components/tareas/TareaDetalle";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tareaId = Number(id);
  const valido = Number.isInteger(tareaId) && tareaId > 0;

  return <TareaDetalle tareaId={valido ? tareaId : null} />;
}
