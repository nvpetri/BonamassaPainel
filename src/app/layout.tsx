import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import { PanelProvider } from "@/components/panel-provider";

export const metadata: Metadata = {
  title: "Bonamassa · Painel da pizzaria",
  description:
    "Pedidos, cozinha e entregas da Bonamassa. Ambiente de demonstração.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#111110" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <PanelProvider>{children}</PanelProvider>
      </body>
    </html>
  );
}
