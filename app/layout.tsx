import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Autodelen",
  description: "Car sharing cooperative",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Autodelen",
  },
};

export const viewport: Viewport = {
  themeColor: "#1976d2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <div className="max-w-2xl mx-auto bg-white min-h-screen shadow-sm pb-16">
            {children}
          </div>
          <BottomTabBar />
        </Providers>
      </body>
    </html>
  );
}
