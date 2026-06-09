import { requireAdmin } from "@/lib/api";
import { createHandler, listHandler } from "@/lib/api/crud-handler";
import { getPayments, insertPayment } from "@/lib/queries/payments";
import { paymentSchema } from "@/lib/schemas/payment";

// Payments are settlement records managed only from the admin-only /payments
// page. The API must enforce the same restriction — without it any
// authenticated member could read or forge payments.
export const GET = listHandler(getPayments, requireAdmin);
export const POST = createHandler(paymentSchema, insertPayment, requireAdmin);
