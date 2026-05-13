import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";

export interface Me {
  personId: number | null;
  shortName: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  isCloaked: boolean;
  themePreference: 'paper' | 'mono' | null;
}

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: () =>
      apiFetch<Me>("/api/me").catch((err) => {
        if (err instanceof ApiError) return null;
        throw err;
      }),
    staleTime: 5 * 60 * 1000,
  });
}
