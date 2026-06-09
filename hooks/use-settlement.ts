import { apiFetch } from "@/lib/api/client";
import type { SettlementResult } from "@/types";
import { useQuery } from "@tanstack/react-query";

export function useSettlement(year: number) {
  return useQuery<SettlementResult>({
    queryKey: ["settlement", year],
    queryFn: () => apiFetch<SettlementResult>(`/api/settlement/${year}`),
  });
}
