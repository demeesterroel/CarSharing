import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

interface OptimisticContext<T> {
  previous: T[] | undefined;
}

interface Factory<T extends { id: number }, TInput> {
  useList: () => ReturnType<typeof useQuery<T[]>>;
  useCreate: () => ReturnType<typeof useMutation<{ id: number }, Error, TInput, OptimisticContext<T>>>;
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
      return useMutation<{ id: number }, Error, TInput, OptimisticContext<T>>({
        mutationFn: (data) =>
          apiFetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }),
        onMutate: async (newData) => {
          await qc.cancelQueries({ queryKey: [key] });
          const previous = qc.getQueryData<T[]>([key]);
          qc.setQueryData<T[]>([key], (old) => [
            ...(old ?? []),
            { ...newData, id: -Date.now() } as unknown as T,
          ]);
          return { previous };
        },
        onError: (_err, _vars, context) => {
          if (context?.previous !== undefined) {
            qc.setQueryData<T[]>([key], context.previous);
          }
        },
        onSettled: () => invalidate(qc),
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
