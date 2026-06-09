import { requireAdmin } from "@/lib/api";
import { deleteHandler, getOneHandler, updateHandler } from "@/lib/api/crud-handler";
import { deletePayment, getPaymentById, updatePayment } from "@/lib/queries/payments";
import { paymentSchema } from "@/lib/schemas/payment";

export const GET = getOneHandler(getPaymentById, requireAdmin);
export const PUT = updateHandler(paymentSchema, updatePayment, requireAdmin);
export const DELETE = deleteHandler(deletePayment, requireAdmin);
