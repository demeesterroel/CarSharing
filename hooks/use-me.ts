import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";

export interface Me {
  personId: number | null;
  shortName: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  isCloaked: boolean;
  themePreference: 'paper' | 'mono' | null;
  /** Whether a mail transport is configured server-side (drives send-vs-copy invite). */
  mailEnabled: boolean;
}

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: () =>
      apiFetch<Me>("/api/me").catch((err) => {
        if (err instanceof ApiError) return null;
        throw err;
      }),
    // Short stale window + refetch on mount/focus so a server-side session
    // revocation (#284) is noticed promptly — on the next navigation or when the
    // user returns to the tab — and the SessionGuard can act on the null result.
    staleTime: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}
