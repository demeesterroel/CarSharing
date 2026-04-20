"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, LayoutDashboard, Car, Users, Wrench, CreditCard, CalendarDays, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { t } from "@/lib/i18n";

const NAV_ITEMS = [
  { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard },
  { href: "/calendar", label: t("nav.calendar"), icon: CalendarDays },
  { href: "/people", label: t("nav.people"), icon: Users },
  { href: "/cars", label: t("nav.cars"), icon: Car },
  { href: "/expenses", label: t("nav.expenses"), icon: Wrench },
  { href: "/payments", label: t("nav.payments"), icon: CreditCard },
];

export function NavDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="p-2 rounded-md hover:bg-gray-100" aria-label={t("nav.menu")}>
          <Menu className="w-5 h-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
        <Dialog.Content className="fixed left-0 top-0 h-full w-72 bg-white z-50 shadow-xl flex flex-col">
          <Dialog.Title className="sr-only">{t("nav.menu")}</Dialog.Title>
          <div className="flex items-center gap-3 p-4 border-b">
            <div className="w-10 h-10 rounded border-2 border-blue-600 flex items-center justify-center">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-lg font-semibold">{t("brand.app")}</span>
            <Dialog.Close asChild>
              <button className="ml-auto p-1 rounded hover:bg-gray-100" aria-label={t("action.cancel")}>
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <nav className="flex-1 py-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-blue-50 transition-colors ${
                  (href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))
                    ? "text-blue-600 bg-blue-50 border-l-4 border-blue-600"
                    : "text-gray-700"
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t py-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {t("nav.logout")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
