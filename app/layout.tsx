import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Courier_Prime } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { CloakBanner } from "@/components/cloak-banner";
import { LocaleProvider } from "@/components/locale-provider";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: "variable",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const courierPrime = Courier_Prime({
  subsets: ["latin"],
  variable: "--font-courier-prime",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AutoDelen — Coöperatieve Antwerpen",
  description: "Eerlijk autodelen voor familie en vrienden",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AutoDelen",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${fraunces.variable} ${inter.variable} ${courierPrime.variable}`}>
      <head></head>
      <body>
        <LocaleProvider>
          <Providers>
            <div
              style={{
                minHeight: "100dvh",
                width: "100%",
                maxWidth: 480,
                margin: "0 auto",
                background: "var(--paper-deep)",
                position: "relative",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
                paddingBottom: 72,
              }}
            >
              <CloakBanner />
              {children}
            </div>
            <BottomTabBar />
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
