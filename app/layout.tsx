import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BottomTabBar } from "@/components/bottom-tab-bar";
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

export const metadata: Metadata = {
  title: "AutoDelen — Coöperatieve Antwerpen",
  description: "Eerlijk autodelen voor familie en vrienden",
  manifest: "/manifest.json",
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
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${fraunces.variable} ${inter.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LocaleProvider>
        <Providers>
          <div
            style={{
              minHeight: "100dvh",
              maxWidth: 480,
              margin: "0 auto",
              background: "var(--paper-deep)",
              position: "relative",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
              paddingBottom: 72,
            }}
          >
            {children}
          </div>
          <BottomTabBar />
        </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
