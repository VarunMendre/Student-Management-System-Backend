import { z } from "zod";
import {
    STUDENT_CASTE_CATEGORIES,
    STUDENT_ENROLLMENT_STATUSES,
    STUDENT_GENDERS,
    normalizeEmail,
    normalizePhone,
    normalizeText
} from "../../utils/studentOptions.js";

// Regex Patterns
const idRegex = /^\d+$/;
const phoneRegex = /^\d{10,15}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const optionalString = () => z.union([z.string(), z.null()]).optional();
const normalizedNameSchema = z.string().transform(normalizeText).pipe(z.string().min(2, "Full name must be at least 2 characters").max(150));
const normalizedEmailSchema = z.string().transform(normalizeEmail).pipe(z.string().regex(emailRegex, "Invalid email format").max(150));
const normalizedPhoneSchema = z.string().transform(normalizePhone).pipe(z.string().regex(phoneRegex, "Mobile number must be 10-15 digits"));
const normalizedOptionalIdText = optionalString().transform((value) => {
    const normalized = normalizeText(value || "");
    return normalized || null;
});

export const studentSchemas = {
    // Schema for POST /api/v1/students (Enrollment)
    enroll: z.object({
        body: z.object({
            full_name: normalizedNameSchema,
            email: normalizedEmailSchema,
            mobile_number: normalizedPhoneSchema,
            alternate_number: normalizedPhoneSchema,
            prn_number: normalizedOptionalIdText,
            eligibility_number: normalizedOptionalIdText,
            department_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            course_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            batch_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            caste_category: z.enum(STUDENT_CASTE_CATEGORIES, {
                errorMap: () => ({ message: `Caste category must be one of: ${STUDENT_CASTE_CATEGORIES.join(", ")}` })
            }),
            gender: z.enum(STUDENT_GENDERS, {
                errorMap: () => ({ message: `Gender must be one of: ${STUDENT_GENDERS.join(", ")}` })
            })
        })
    }),

    // Schema for PATCH /api/v1/students/:id (Partial update)
    update: z.object({
        params: z.object({
            id: z.string().regex(idRegex, "Invalid student ID format")
        }),
        body: z.object({
            full_name: normalizedNameSchema.optional(),
            email: normalizedEmailSchema.optional(),
            mobile_number: normalizedPhoneSchema.optional(),
            alternate_number: normalizedPhoneSchema.optional(),
            prn_number: normalizedOptionalIdText,
            eligibility_number: normalizedOptionalIdText,
            department_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)).optional(),
            course_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)).optional(),
            batch_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)).optional(),
            caste_category: z.enum(STUDENT_CASTE_CATEGORIES).optional(),
            gender: z.enum(STUDENT_GENDERS).optional(),
            enrollment_status: z.enum(STUDENT_ENROLLMENT_STATUSES).optional()
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
            status: z.enum(STUDENT_ENROLLMENT_STATUSES).optional(),
            search: z.string().max(100).optional(),
            page: z.coerce.number().int().positive().default(1),
            limit: z.coerce.number().int().positive().max(10000).default(10)
        }).optional().default({})
    }),

    bulkImport: z.object({
        body: z.object({
            department_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            course_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            batch_id: z.number().int().positive().or(z.string().regex(idRegex).transform(Number)),
            target_year: z.string().min(2),
            students: z.array(
                z.object({
                    full_name: normalizedNameSchema,
                    email: z.string().transform(normalizeEmail).pipe(z.string().regex(emailRegex, "Invalid email format").max(150)),
                    mobile_number: z.string().transform(normalizePhone).pipe(z.string().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits")),
                    alternate_number: z.string().transform(normalizePhone).pipe(z.string().regex(/^\d{10}$/, "Alternate number must be exactly 10 digits")).optional().or(z.literal("")),
                    caste_category: z.enum(STUDENT_CASTE_CATEGORIES, {
                        errorMap: () => ({ message: `Category must be one of: ${STUDENT_CASTE_CATEGORIES.join(", ")}` })
                    }),
                    gender: z.preprocess(
                        (val) => {
                            if (typeof val === "string") {
                                const upper = val.toUpperCase().trim();
                                if (upper === "MALE") return "Male";
                                if (upper === "FEMALE") return "Female";
                            }
                            return val;
                        },
                        z.enum(STUDENT_GENDERS, {
                            errorMap: () => ({ message: "Gender must be MALE or FEMALE" })
                        })
                    ),
                    prn_number: normalizedOptionalIdText.optional().or(z.literal("")),
                    eligibility_number: normalizedOptionalIdText.optional().or(z.literal("")),
                    total_paid: z.number().min(0).default(0),
                    balance: z.number().min(0).default(0)
                })
            ).min(1).max(500)
        })
    }),

    // Schema for GET /api/v1/students/:id
    byId: z.object({
        params: z.object({
            id: z.string().regex(idRegex, "Invalid student ID format")
        })
    }),
    metadata: z.object({})
};
