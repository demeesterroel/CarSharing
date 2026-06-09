"use client";
import { apiFetch } from "@/lib/api/client";
import {
  applyCreate,
  applyDelete,
  applyUpdate,
  replaceCreate,
  rollbackCreate,
} from "@/lib/offline/optimistic";
import { enqueue } from "@/lib/offline/outbox";
import { newUuid } from "@/lib/offline/uuid";
import type { FuelFillup, FuelFillupInput } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const QUERY_KEY = "fuel-fillups";
const PATH = "/api/fuel";
const INVALIDATE = [["dashboard"], ["car-state"]];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [QUERY_KEY] });
  for (const k of INVALIDATE) qc.invalidateQueries({ queryKey: k });
}

function getCsrfToken(): string {
  return document.cookie.match(/csrf-token=([^;]+)/)?.[1] ?? "";
}

export function useFuelFillups() {
  return useQuery<FuelFillup[]>({
    queryKey: [QUERY_KEY],
    queryFn: () => apiFetch<FuelFillup[]>(PATH),
  });
}

export function useCreateFuelFillup() {
  const qc = useQueryClient();
  return useMutation<FuelFillup, Error, FuelFillupInput>({
    mutationFn: async (input: FuelFillupInput): Promise<FuelFillup> => {
      const client_id = newUuid();
      const optimistic: FuelFillup = {
        id: -Date.now(),
        client_id,
        person_id: input.person_id,
        car_id: input.car_id,
        date: input.date,
        amount: input.amount,
        liters: input.liters,
        price_per_liter: input.liters > 0 ? input.amount / input.liters : 0,
        full_tank: input.full_tank ?? 0,
        settled_outside: input.settled_outside ?? 0,
        odometer: input.odometer ?? null,
        receipt: input.receipt ?? null,
        location: input.location ?? null,
        gps_coords: input.gps_coords ?? null,
        updated_at: new Date().toISOString(),
      };
      applyCreate<FuelFillup>(qc, [QUERY_KEY], optimistic);

      try {
        const res = await fetch(PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
          body: JSON.stringify({ ...input, client_id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const server = (await res.json()) as FuelFillup;
        replaceCreate<FuelFillup>(qc, [QUERY_KEY], client_id, server);
        invalidateAll(qc);
        return server;
      } catch {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueue({
            url: PATH,
            method: "POST",
            body: { ...input, client_id },
            resource: "fuel-fillups",
            client_id,
          });
          return optimistic;
        }
        rollbackCreate<FuelFillup>(qc, [QUERY_KEY], client_id);
        throw new Error("Failed to create fuel fillup");
      }
    },
  });
}

export function useUpdateFuelFillup() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, FuelFillupInput & { id: number }>({
    mutationFn: async ({ id, ...input }) => {
      const existing = qc.getQueryData<FuelFillup[]>([QUERY_KEY])?.find((f) => f.id === id);
      applyUpdate<FuelFillup>(qc, [QUERY_KEY], id, input as Partial<FuelFillup>);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        };
        if (existing?.updated_at) headers["X-Expected-Updated-At"] = existing.updated_at;
        const res = await fetch(`${PATH}/${id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        invalidateAll(qc);
        return res.json();
      } catch (e) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueue({
            url: `${PATH}/${id}`,
            method: "PUT",
            body: input,
            resource: "fuel-fillups",
            resource_id: id,
            expectedUpdatedAt: existing?.updated_at,
          });
          return {};
        }
        if (existing) applyUpdate<FuelFillup>(qc, [QUERY_KEY], id, existing);
        if (e instanceof Error && e.message === "HTTP 403")
          throw new Error("No permission to update this record");
        throw new Error("Failed to update fuel fillup");
      }
    },
  });
}

export function useDeleteFuelFillup() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: async (id: number) => {
      applyDelete<FuelFillup>(qc, [QUERY_KEY], id);

      try {
        const res = await fetch(`${PATH}/${id}`, {
          method: "DELETE",
          headers: { "x-csrf-token": getCsrfToken() },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        invalidateAll(qc);
        return res.json();
      } catch (e) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueue({
            url: `${PATH}/${id}`,
            method: "DELETE",
            body: null,
            resource: "fuel-fillups",
            resource_id: id,
          });
          return {};
        }
        invalidateAll(qc);
        if (e instanceof Error && e.message === "HTTP 403")
          throw new Error("No permission to delete this record");
        throw new Error("Failed to delete fuel fillup");
      }
    },
  });
}

// Legacy named exports for backwards compatibility
export const fuelFillupsHooks = {
  useList: useFuelFillups,
  useCreate: useCreateFuelFillup,
  useUpdate: useUpdateFuelFillup,
  useDelete: useDeleteFuelFillup,
};

export const useFuelFillup = useFuelFillups;
