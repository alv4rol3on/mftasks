import IniciarTareaPage from "@/components/tareas/IniciarTareaPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tareaId = Number(id);
  const valido = Number.isInteger(tareaId) && tareaId > 0;

  return <IniciarTareaPage tareaId={valido ? tareaId : null} />;
}
