import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

interface Factory<T extends { id: number }, TInput> {
  useList: () => ReturnType<typeof useQuery<T[]>>;
  useCreate: () => ReturnType<typeof useMutation<{ id: number }, Error, TInput>>;
  useUpdate: () => ReturnType<typeof useMutation<unknown, Error, TInput & { id: number }>>;
  useDelete: () => ReturnType<typeof useMutation<unknown, Error, number>>;
}

export function createResourceHooks<T extends { id: number }, TInput>(
  key: string,
  path: string,
  opts?: { invalidate?: QueryKey[] }
): Factory<T, TInput> {
  const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
    qc.invalidateQueries({ queryKey: [key] });
    for (const k of opts?.invalidate ?? []) qc.invalidateQueries({ queryKey: k });
  };

  return {
    useList: () => useQuery<T[]>({ queryKey: [key], queryFn: () => apiFetch<T[]>(path) }),

    useCreate: () => {
      const qc = useQueryClient();
      return useMutation<{ id: number }, Error, TInput>({
        mutationFn: (data) =>
          apiFetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }),
        onSuccess: () => invalidate(qc),
      });
    },

    useUpdate: () => {
      const qc = useQueryClient();
      return useMutation<unknown, Error, TInput & { id: number }>({
        mutationFn: ({ id, ...data }) =>
          apiFetch(`${path}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }),
        onSuccess: () => invalidate(qc),
      });
    },

    useDelete: () => {
      const qc = useQueryClient();
      return useMutation<unknown, Error, number>({
        mutationFn: (id) => apiFetch(`${path}/${id}`, { method: "DELETE" }),
        onSuccess: () => invalidate(qc),
      });
    },
  };
}
