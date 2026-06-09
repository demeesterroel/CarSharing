import type { Payment, PaymentInput } from "@/types";
import { createResourceHooks } from "./use-resource";

export const paymentsHooks = createResourceHooks<Payment, PaymentInput>(
  "payments",
  "/api/payments",
  { invalidate: [["dashboard"]] }
);

export const usePayments = paymentsHooks.useList;
export const useCreatePayment = paymentsHooks.useCreate;
export const useUpdatePayment = paymentsHooks.useUpdate;
export const useDeletePayment = paymentsHooks.useDelete;
