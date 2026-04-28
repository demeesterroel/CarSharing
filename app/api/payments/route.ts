import { getPayments, insertPayment } from "@/lib/queries/payments";
import { paymentSchema } from "@/lib/schemas/payment";
import { listHandler, createHandler } from "@/lib/api/crud-handler";

export const GET = listHandler(getPayments);
export const POST = createHandler(paymentSchema, insertPayment);
