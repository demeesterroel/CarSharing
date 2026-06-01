import { getPaymentById, updatePayment, deletePayment } from "@/lib/queries/payments";
import { paymentSchema } from "@/lib/schemas/payment";
import { getOneHandler, updateHandler, deleteHandler } from "@/lib/api/crud-handler";
import { requireAdmin } from "@/lib/api";

export const GET = getOneHandler(getPaymentById, requireAdmin);
export const PUT = updateHandler(paymentSchema, updatePayment, requireAdmin);
export const DELETE = deleteHandler(deletePayment, requireAdmin);
