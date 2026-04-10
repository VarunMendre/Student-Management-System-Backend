import { z } from "zod";

// Regex Patterns
const idRegex = /^\d+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD

const paymentModes = ["Cash", "UPI", "Bank Transfer", "Cheque", "DD", "Online"];

export const paymentSchemas = {
    // Schema for POST /api/v1/students/:id/payments
    create: z.object({
        params: z.object({
            id: z.string().regex(idRegex, "Invalid student ID format")
        }),
        body: z.object({
            ledger_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            amount_paid: z.number().positive("Amount must be greater than 0")
                .or(z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format").transform(val => parseFloat(val))),
            payment_mode: z.enum(paymentModes, {
                errorMap: () => ({ message: `Payment mode must be one of: ${paymentModes.join(", ")}` })
            }),
            payment_reference: z.string().max(100).nullable().optional().default(null),
            remarks: z.string().max(255).nullable().optional().default(null),
            transaction_date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format").optional()
        })
    }),

    // Schema for GET /api/v1/students/:id/transactions
    listTransactions: z.object({
        params: z.object({
            id: z.string().regex(idRegex, "Invalid student ID format")
        }),
        query: z.object({
            academic_year_num: z.string().regex(idRegex).transform(Number).optional()
        }).optional().default({})
    }),

    // Schema for GET /api/v1/students/:id/transactions/:txn_id
    transactionById: z.object({
        params: z.object({
            id: z.string().regex(idRegex, "Invalid student ID format"),
            txn_id: z.string().regex(idRegex, "Invalid transaction ID format")
        })
    }),

    // Schema for GET /api/v1/students/:id/fee-ledger
    feeLedger: z.object({
        params: z.object({
            id: z.string().regex(idRegex, "Invalid student ID format")
        })
    })
};
