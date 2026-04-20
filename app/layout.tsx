import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("brand.app"),
  description: t("brand.description"),
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
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
