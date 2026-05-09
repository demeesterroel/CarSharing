import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

interface AdminSettings {
  coop_bank_account: string;
  google_calendar_id: string;
  google_oauth_refresh_token: string;
}

export function useAdminSettings() {
  return useQuery<AdminSettings>({
    queryKey: ["admin-settings"],
    queryFn: () => apiFetch<AdminSettings>("/api/admin/settings"),
  });
}

export function useSaveAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AdminSettings>) =>
      apiFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-settings"] }),
  });
}
