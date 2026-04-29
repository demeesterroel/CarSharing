import type { QueryClient } from "@tanstack/react-query";

export function applyCreate<T extends { id: number; client_id?: string | null }>(
  qc: QueryClient,
  key: readonly unknown[],
  pending: T
): void {
  qc.setQueryData<T[]>(key, (old) => [pending, ...(old ?? [])]);
}

export function replaceCreate<T extends { id: number; client_id?: string | null }>(
  qc: QueryClient,
  key: readonly unknown[],
  clientId: string,
  server: T
): void {
  qc.setQueryData<T[]>(key, (old) =>
    (old ?? []).map((row) => (row.client_id === clientId ? server : row))
  );
}

export function rollbackCreate<T extends { id: number; client_id?: string | null }>(
  qc: QueryClient,
  key: readonly unknown[],
  clientId: string
): void {
  qc.setQueryData<T[]>(key, (old) => (old ?? []).filter((row) => row.client_id !== clientId));
}

export function applyUpdate<T extends { id: number }>(
  qc: QueryClient,
  key: readonly unknown[],
  id: number,
  patch: Partial<T>
): void {
  qc.setQueryData<T[]>(key, (old) =>
    (old ?? []).map((row) => (row.id === id ? { ...row, ...patch } : row))
  );
}

export function applyDelete<T extends { id: number }>(
  qc: QueryClient,
  key: readonly unknown[],
  id: number
): void {
  qc.setQueryData<T[]>(key, (old) => (old ?? []).filter((row) => row.id !== id));
}
