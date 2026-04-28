import { getPaymentById, updatePayment, deletePayment } from "@/lib/queries/payments";
import { paymentSchema } from "@/lib/schemas/payment";
import { getOneHandler, updateHandler, deleteHandler } from "@/lib/api/crud-handler";

export const GET = getOneHandler(getPaymentById);
export const PUT = updateHandler(paymentSchema, updatePayment);
export const DELETE = deleteHandler(deletePayment);
