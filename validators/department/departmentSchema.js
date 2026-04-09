import { z } from "zod";

// Regex Patterns
const nameRegex = /^[a-zA-Z\s\-']{2,100}$/;
const idRegex = /^\d+$/;

export const departmentSchemas = {
    // Schema for POST /departments
    create: z.object({
        body: z.object({
            name: z.string()
                .regex(nameRegex, "Department name must contain only letters, spaces, or hyphens (2-100 characters)")
        })
    }),

    // Schema for PUT /departments/:id
    update: z.object({
        params: z.object({
            id: z.string().regex(idRegex, "Invalid Department ID format")
        }),
        body: z.object({
            name: z.string()
                .regex(nameRegex, "Department name must contain only letters, spaces, or hyphens (2-100 characters)")
        })
    }),

    // Schema for GET/DELETE /departments/:id
    byId: z.object({
        params: z.object({
            id: z.string().regex(idRegex, "Invalid Department ID format")
        })
    })
};
