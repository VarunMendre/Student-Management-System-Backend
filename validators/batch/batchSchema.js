import { z } from "zod";

// Regex Patterns
const idRegex = /^\d+$/;
const batchNameRegex = /^[0-9]{4}\s*\-\s*[0-9]{4}$/; // e.g., "2025 - 2029"
const yearRegex = /^\d{4}$/;
const componentNameRegex = /^[a-zA-Z0-9\s\-_]{2,100}$/;
const amountRegex = /^\d+(\.\d{1,2})?$/;

export const batchSchemas = {
    // Schema for POST /batches
    create: z.object({
        body: z.object({
            course_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            batch_name: z.string().regex(batchNameRegex, "Batch name must follow the format 'YYYY - YYYY'"),
            admission_year: z.number().int().min(1900).max(2100).or(z.string().regex(yearRegex).transform(Number)),
            total_seats: z.number().int().nonnegative().or(z.string().regex(idRegex).transform(Number))
        })
    }),

    // Schema for PUT /batches/:batch_id/fees
    saveFees: z.object({
        params: z.object({
            batch_id: z.string().regex(idRegex, "Invalid Batch ID format")
        }),
        body: z.object({
            components: z.array(z.object({
                component_name: z.string().regex(componentNameRegex, "Invalid component name format"),
                amount: z.number().nonnegative().or(z.string().regex(amountRegex).transform(val => parseFloat(val)))
            })).optional()
        })
    }),

    // Schema for GET /batches/:batch_id
    byId: z.object({
        params: z.object({
            batch_id: z.string().regex(idRegex, "Invalid Batch ID format")
        })
    })
};
