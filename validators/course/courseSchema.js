import { z } from "zod";
import { normalizeText } from "../../utils/studentOptions.js";

const idSchema = z.string().regex(/^\d+$/, "Invalid ID format");
const normalizedTextSchema = (label, min = 2, max = 150) => z.string()
    .transform(normalizeText)
    .pipe(z.string().min(min, `${label} must be at least ${min} characters`).max(max, `${label} must be at most ${max} characters`));

export const courseSchemas = {
    byId: z.object({
        params: z.object({
            id: idSchema
        })
    }),
    create: z.object({
        body: z.object({
            course_name: normalizedTextSchema("Course name"),
            duration: z.coerce.number().int().min(1).max(10),
            department_id: z.coerce.number().int().positive(),
            course_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/, "Course code must be 2-20 characters and use only letters, numbers, underscore, or hyphen"),
            program_level: normalizedTextSchema("Program level", 2, 50).optional().nullable()
        })
    }),
    update: z.object({
        params: z.object({
            id: idSchema
        }),
        body: z.object({
            course_name: normalizedTextSchema("Course name").optional(),
            duration: z.coerce.number().int().min(1).max(10).optional(),
            department_id: z.coerce.number().int().positive().optional(),
            course_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/, "Course code must be 2-20 characters and use only letters, numbers, underscore, or hyphen").optional(),
            program_level: normalizedTextSchema("Program level", 2, 50).optional().nullable()
        }).refine((body) => Object.keys(body).length > 0, {
            message: "At least one field must be provided for update"
        })
    })
};
