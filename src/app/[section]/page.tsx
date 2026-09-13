import { notFound } from "next/navigation";
import { ApiDashboard } from "@/components/api-dashboard";
import { Dashboard } from "@/components/dashboard";
import { views, type View } from "@/domain/views";

export function generateStaticParams() {
  return views.map((section) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!views.includes(section as View)) notFound();
  return process.env.PANEL_MODE === "demo" ? (
    <Dashboard view={section as View} />
  ) : (
    <ApiDashboard view={section as View} />
  );
}
