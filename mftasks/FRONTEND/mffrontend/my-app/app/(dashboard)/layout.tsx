import DashboardLayout from "../../components/DashboardLayout";

export const metadata = {
  title: "MF Tasks",
  description: "Sistema de solicitudes y tareas MF",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}