import { useQuery } from "@tanstack/react-query";

export interface Me {
  personId: number | null;
  personName: string | null;
  isAdmin: boolean;
  isOwner: boolean;
}

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
