import DashboardLayout from "../../components/DashboardLayout";

export const metadata = {
  title: "MF",
  description: "MF en Next.js",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}