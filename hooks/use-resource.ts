import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

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
    useList: () =>
      useQuery<T[]>({ queryKey: [key], queryFn: () => send<T[]>(path) }),

    useCreate: () => {
      const qc = useQueryClient();
      return useMutation<{ id: number }, Error, TInput>({
        mutationFn: (data) => send(path, {
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
        mutationFn: ({ id, ...data }) => send(`${path}/${id}`, {
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
        mutationFn: (id) => send(`${path}/${id}`, { method: "DELETE" }),
        onSuccess: () => invalidate(qc),
      });
    },
  };
}
