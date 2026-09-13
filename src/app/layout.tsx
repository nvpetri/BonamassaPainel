import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import { ApiPanelProvider } from "@/components/api-provider";
import { PanelProvider } from "@/components/panel-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bonamassa · Painel da pizzaria",
  description: "Pedidos, cozinha e entregas da Bonamassa.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#111110" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const Provider =
    process.env.PANEL_MODE === "demo" ? PanelProvider : ApiPanelProvider;
  return (
    <html lang="pt-BR">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
