import type { Metadata, Viewport } from "next";

// Configuración de metadataBase y metadata general
export const metadata: Metadata = {
  title: "Pro Agent",
  description: "Predictive analytics application",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://gda-accounts-five.vercel.app"
  ),
};

// Configuración separada para viewport
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Puedes agregar más configuraciones de viewport según necesites
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function PredictiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="[color-scheme:dark] h-screen overflow-hidden">
      <div className="relative w-full h-full">{children}</div>
    </div>
  );
}
