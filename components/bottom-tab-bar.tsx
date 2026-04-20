"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route, Fuel } from "lucide-react";
import { t } from "@/lib/i18n";

const TABS = [
  { href: "/trips", label: t("nav.trips"), icon: Route },
  { href: "/fuel", label: t("nav.fuel"), icon: Fuel },
];

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("nav.primary")}
      className="fixed bottom-0 inset-x-0 z-30 border-t bg-white"
    >
      <div className="max-w-2xl mx-auto grid grid-cols-2 h-16">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                active ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className={active ? "font-medium" : ""}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
