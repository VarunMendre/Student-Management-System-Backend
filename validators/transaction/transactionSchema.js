import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const paymentModes = ["Cash", "UPI", "Cheque", "DD", "Online", "NEFT", "RTGS", "Scholarship"];

export const transactionSchemas = {
    listAll: z.object({
        query: z.object({
            date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format").optional(),
            transaction_date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format").optional(),
            startDate: z.string().regex(dateRegex, "Start date must be in YYYY-MM-DD format").optional(),
            fromDate: z.string().regex(dateRegex, "Start date must be in YYYY-MM-DD format").optional(),
            start_date: z.string().regex(dateRegex, "Start date must be in YYYY-MM-DD format").optional(),
            endDate: z.string().regex(dateRegex, "End date must be in YYYY-MM-DD format").optional(),
            toDate: z.string().regex(dateRegex, "End date must be in YYYY-MM-DD format").optional(),
            end_date: z.string().regex(dateRegex, "End date must be in YYYY-MM-DD format").optional(),
            paymentMode: z.enum(paymentModes).optional(),
            payment_mode: z.enum(paymentModes).optional(),
            limit: z.coerce.number().int().min(1).max(500).optional(),
            offset: z.coerce.number().int().min(0).max(50000).optional()
        }).refine((query) => {
            const start = query.startDate || query.fromDate || query.start_date;
            const end = query.endDate || query.toDate || query.end_date;
            return (!start && !end) || (start && end);
        }, {
            message: "Both start and end date are required when using date ranges"
        })
    })
};
