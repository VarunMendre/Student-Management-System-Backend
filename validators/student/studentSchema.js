import { z } from "zod";

// Regex Patterns
const idRegex = /^\d+$/;
const phoneRegex = /^\d{10,15}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const casteCategories = ["General", "EWS", "OBC", "SC", "ST", "VJA", "NTB", "NTC", "NTD", "SBC", "SEBC", "VJNT", "NT-A", "NT-B", "NT-C", "NT-D"];
const genderOptions = ["Male", "Female", "Other"];
const statusOptions = ["Active", "Inactive", "Graduated", "Dropped"];

export const studentSchemas = {
    // Schema for POST /api/v1/students (Enrollment)
    enroll: z.object({
        body: z.object({
            full_name: z.string().min(2, "Full name must be at least 2 characters").max(150),
            email: z.string().regex(emailRegex, "Invalid email format").max(150),
            mobile_number: z.string().regex(phoneRegex, "Mobile number must be 10-15 digits"),
            alternate_number: z.string().regex(phoneRegex, "Alternate number must be 10-15 digits"),
            prn_number: z.string().max(50).nullable().optional().default(null),
            eligibility_number: z.string().max(50).nullable().optional().default(null),
            department_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            course_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            batch_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            caste_category: z.enum(casteCategories, {
                errorMap: () => ({ message: `Caste category must be one of: ${casteCategories.join(", ")}` })
            }),
            gender: z.enum(genderOptions, {
                errorMap: () => ({ message: `Gender must be one of: ${genderOptions.join(", ")}` })
            })
        })
    }),

    // Schema for PATCH /api/v1/students/:id (Partial update)
    update: z.object({
        params: z.object({
            id: z.string().regex(idRegex, "Invalid student ID format")
        }),
        body: z.object({
            full_name: z.string().min(2).max(150).optional(),
            email: z.string().regex(emailRegex, "Invalid email format").max(150).optional(),
            mobile_number: z.string().regex(phoneRegex, "Mobile number must be 10-15 digits").optional(),
            alternate_number: z.string().regex(phoneRegex, "Alternate number must be 10-15 digits").optional(),
            prn_number: z.string().max(50).nullable().optional(),
            eligibility_number: z.string().max(50).nullable().optional(),
            enrollment_status: z.enum(statusOptions).optional()
        }).refine(obj => Object.keys(obj).length > 0, {
            message: "At least one field must be provided for update"
        })
    }),

    // Schema for GET /api/v1/students (List with filters)
    list: z.object({
        query: z.object({
            department_id: z.string().regex(idRegex).transform(Number).optional(),
            course_id: z.string().regex(idRegex).transform(Number).optional(),
            batch_id: z.string().regex(idRegex).transform(Number).optional(),
            status: z.enum(statusOptions).optional(),
            search: z.string().max(100).optional(),
            page: z.coerce.number().int().positive().default(1),
            limit: z.coerce.number().int().positive().max(100).default(10)
        }).optional().default({})
    }),

    // Schema for GET /api/v1/students/:id
    byId: z.object({
        params: z.object({
            id: z.string().regex(idRegex, "Invalid student ID format")
        })
    })
};
