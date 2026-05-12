"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import { newUuid } from "@/lib/offline/uuid";
import { enqueue } from "@/lib/offline/outbox";
import {
  applyCreate,
  replaceCreate,
  rollbackCreate,
  applyUpdate,
  applyDelete,
} from "@/lib/offline/optimistic";
import type { Trip, TripInput } from "@/types";

const QUERY_KEY = "trips";
const PATH = "/api/trips";
const INVALIDATE = [["dashboard"], ["car-state"]];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [QUERY_KEY] });
  for (const k of INVALIDATE) qc.invalidateQueries({ queryKey: k });
}

export function useTrips() {
  return useQuery<Trip[]>({
    queryKey: [QUERY_KEY],
    queryFn: () => apiFetch<Trip[]>(PATH),
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation<Trip, Error, TripInput>({
    mutationFn: async (input: TripInput): Promise<Trip> => {
      const client_id = newUuid();
      const optimistic: Trip = {
        id: -Date.now(),
        client_id,
        person_id: input.person_id,
        car_id: input.car_id,
        date: input.date,
        start_odometer: input.start_odometer,
        end_odometer: input.end_odometer,
        km: input.end_odometer - input.start_odometer,
        amount: 0,
        location: input.location ?? null,
        gps_coords: input.gps_coords ?? null,
        parking: input.parking ?? null,
        updated_at: new Date().toISOString(),
      };
      applyCreate<Trip>(qc, [QUERY_KEY], optimistic);

      try {
        const res = await fetch(PATH, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": document.cookie.match(/csrf-token=([^;]+)/)?.[1] ?? "",
          },
          body: JSON.stringify({ ...input, client_id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const server = (await res.json()) as Trip;
        replaceCreate<Trip>(qc, [QUERY_KEY], client_id, server);
        invalidateAll(qc);
        return server;
      } catch {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueue({
            url: PATH,
            method: "POST",
            body: { ...input, client_id },
            resource: "trips",
            client_id,
          });
          return optimistic;
        }
        rollbackCreate<Trip>(qc, [QUERY_KEY], client_id);
        throw new Error("Failed to create trip");
      }
    },
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, TripInput & { id: number }>({
    mutationFn: async ({ id, ...input }) => {
      const existing = qc.getQueryData<Trip[]>([QUERY_KEY])?.find((t) => t.id === id);
      applyUpdate<Trip>(qc, [QUERY_KEY], id, input as Partial<Trip>);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-csrf-token": document.cookie.match(/csrf-token=([^;]+)/)?.[1] ?? "",
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
            resource: "trips",
            resource_id: id,
            expectedUpdatedAt: existing?.updated_at,
          });
          return {};
        }
        // rollback: re-apply the old values
        if (existing) applyUpdate<Trip>(qc, [QUERY_KEY], id, existing);
        if (e instanceof Error && e.message === "HTTP 403")
          throw new Error("No permission to update this record");
        throw new Error("Failed to update trip");
      }
    },
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: async (id: number) => {
      applyDelete<Trip>(qc, [QUERY_KEY], id);

      try {
        const res = await fetch(`${PATH}/${id}`, {
          method: "DELETE",
          headers: {
            "x-csrf-token": document.cookie.match(/csrf-token=([^;]+)/)?.[1] ?? "",
          },
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
            resource: "trips",
            resource_id: id,
          });
          return {};
        }
        invalidateAll(qc); // re-fetch to restore
        if (e instanceof Error && e.message === "HTTP 403")
          throw new Error("No permission to delete this record");
        throw new Error("Failed to delete trip");
      }
    },
  });
}
