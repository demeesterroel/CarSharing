"use client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";
import { OnlineStateProvider } from "@/lib/offline/online-state";
import { useBootPrewarm } from "@/lib/offline/prewarm";

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
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <OnlineStateProvider>
        <BootPrewarm />
        {children}
        <Toaster position="bottom-center" />
      </OnlineStateProvider>
    </QueryClientProvider>
  );
}
