"use client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { OnlineStateProvider, useOnlineState } from "@/lib/offline/online-state";
import { useBootPrewarm } from "@/lib/offline/prewarm";
import { useSyncEngine } from "@/lib/offline/sync-engine";
import { useT } from "@/components/locale-provider";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { useMe } from "@/hooks/use-me";
import PullToRefresh from "@/components/pull-to-refresh";

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
