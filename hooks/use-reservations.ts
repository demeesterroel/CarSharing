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
import type { Reservation, ReservationInput } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const QUERY_KEY = "reservations";
const PATH = "/api/reservations";

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [QUERY_KEY] });
}

function getCsrfToken(): string {
  return document.cookie.match(/csrf-token=([^;]+)/)?.[1] ?? "";
}

export function useReservations() {
  return useQuery<Reservation[]>({
    queryKey: [QUERY_KEY],
    queryFn: () => apiFetch<Reservation[]>(PATH),
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation<Reservation, Error, ReservationInput>({
    mutationFn: async (input: ReservationInput): Promise<Reservation> => {
      const client_id = newUuid();
      const optimistic: Reservation = {
        id: -Date.now(),
        client_id,
        person_id: input.person_id,
        car_id: input.car_id,
        start_date: input.start_date,
        end_date: input.end_date,
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        status: input.status ?? "pending",
        note: input.note ?? null,
        updated_at: new Date().toISOString(),
        google_event_id: null,
        last_synced_etag: null,
        last_app_write_nonce: null,
        last_known_response_status: null,
      };
      applyCreate<Reservation>(qc, [QUERY_KEY], optimistic);

      try {
        const res = await fetch(PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
          body: JSON.stringify({ ...input, client_id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const server = (await res.json()) as Reservation;
        replaceCreate<Reservation>(qc, [QUERY_KEY], client_id, server);
        invalidateAll(qc);
        return server;
      } catch {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueue({
            url: PATH,
            method: "POST",
            body: { ...input, client_id },
            resource: "reservations",
            client_id,
          });
          return optimistic;
        }
        rollbackCreate<Reservation>(qc, [QUERY_KEY], client_id);
        throw new Error("Failed to create reservation");
      }
    },
  });
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, ReservationInput & { id: number }>({
    mutationFn: async ({ id, ...input }) => {
      const existing = qc.getQueryData<Reservation[]>([QUERY_KEY])?.find((r) => r.id === id);
      applyUpdate<Reservation>(qc, [QUERY_KEY], id, input as Partial<Reservation>);

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
            resource: "reservations",
            resource_id: id,
            expectedUpdatedAt: existing?.updated_at,
          });
          return {};
        }
        if (existing) applyUpdate<Reservation>(qc, [QUERY_KEY], id, existing);
        if (e instanceof Error && e.message === "HTTP 403")
          throw new Error("No permission to update this record");
        throw new Error("Failed to update reservation");
      }
    },
  });
}

export function useDeleteReservation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: async (id: number) => {
      applyDelete<Reservation>(qc, [QUERY_KEY], id);

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
            resource: "reservations",
            resource_id: id,
          });
          return {};
        }
        invalidateAll(qc);
        if (e instanceof Error && e.message === "HTTP 403")
          throw new Error("No permission to delete this record");
        throw new Error("Failed to delete reservation");
      }
    },
  });
}

export function useUpdateReservationStatus() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { id: number; status: string }>({
    mutationFn: async ({ id, status }) => {
      // Status changes (confirm/reject) are admin-only and require connectivity.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        toast.error("Bevestigen/afwijzen kan alleen online.");
        throw new Error("offline");
      }
      const res = await fetch(`${PATH}/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidateAll(qc);
      return res.json();
    },
  });
}

export const reservationsHooks = {
  useList: useReservations,
  useCreate: useCreateReservation,
  useUpdate: useUpdateReservation,
  useDelete: useDeleteReservation,
};
