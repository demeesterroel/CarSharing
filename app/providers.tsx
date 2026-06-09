"use client";
import { useT } from "@/components/locale-provider";
import PullToRefresh from "@/components/pull-to-refresh";
import { useMe } from "@/hooks/use-me";
import { OnlineStateProvider, useOnlineState } from "@/lib/offline/online-state";
import { useBootPrewarm } from "@/lib/offline/prewarm";
import { useSyncEngine } from "@/lib/offline/sync-engine";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast, Toaster } from "sonner";

// Guest pages where an unauthenticated (null) session is expected; never bounce
// away from these. Mirrors the GUEST/PUBLIC page prefixes in proxy.ts.
const PUBLIC_PAGE_PREFIXES = ["/login", "/forgot", "/reset", "/invite"];
function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * App-wide reaction to server-side session revocation (issue #284).
 *
 * The Edge proxy gates page navigation on cookie fields only and can't see the
 * DB session epoch, so a revoked-but-undestroyed cookie still loads pages. The
 * API layer 403s ("Session revoked") and /api/me resolves to null. This guard
 * turns either signal into a real logout: clear caches and redirect to /login.
 */
function SessionGuard() {
  const { data: me, isFetched } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();

  const logout = useCallback(() => {
    // Destroy the still-present cookie first. The Edge proxy gates on cookie
    // fields only, so a revoked-but-undestroyed cookie still reads as
    // "authenticated" and would bounce /login straight back to / — leaving the
    // user stuck. /api/auth/logout clears the cookie (no CSRF required); only
    // then does the redirect to /login stick.
    void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      qc.clear();
      router.replace("/login");
    });
  }, [qc, router]);

  // A revoked/expired session surfaces as a null /api/me (on load, navigation,
  // mount, or window-focus refetch). Bounce to /login unless already on a guest
  // page.
  useEffect(() => {
    if (isFetched && me === null && !isPublicPage(pathname)) {
      logout();
    }
  }, [isFetched, me, pathname, logout]);

  // An API 403 "Session revoked" mid-session (e.g. an admin revoke while the tab
  // is open) logs out immediately, before /api/me is refetched.
  useEffect(() => {
    const handler = () => {
      if (!isPublicPage(window.location.pathname)) logout();
    };
    window.addEventListener("session-revoked", handler);
    return () => window.removeEventListener("session-revoked", handler);
  }, [logout]);

  return null;
}

function BootPrewarm() {
  // useMe is the auth signal. Read it here so prewarm gates on auth.
  const { data, isFetched } = useQuery<{ personId: number | null } | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  useBootPrewarm(isFetched && data?.personId != null);
  const { setPendingCount } = useOnlineState();
  useSyncEngine({ setPendingCount });
  return null;
}

function ThemeSync() {
  const { data: me } = useMe();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (me?.themePreference) {
      setTheme(me.themePreference);
    }
  }, [me?.themePreference, setTheme]);

  return null;
}

function ConflictListener() {
  const t = useT();
  useEffect(() => {
    const handler = (e: Event) => {
      toast.error(t("offline.conflict_toast"));
    };
    window.addEventListener("offline-conflict", handler);
    return () => window.removeEventListener("offline-conflict", handler);
  }, [t]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <OnlineStateProvider>
        <ThemeProvider>
          <BootPrewarm />
          <SessionGuard />
          <ThemeSync />
          <ConflictListener />
          {/* No-op in a normal browser tab; active only when installed as a PWA. */}
          <PullToRefresh />
          {children}
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </OnlineStateProvider>
    </QueryClientProvider>
  );
}
