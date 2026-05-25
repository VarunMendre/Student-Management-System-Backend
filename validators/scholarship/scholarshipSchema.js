import { z } from "zod";
import { STUDENT_CASTE_CATEGORIES, STUDENT_GENDERS, normalizeText } from "../../utils/studentOptions.js";

const idSchema = z.string().regex(/^\d+$/, "Invalid ID format");
const applicationIdSchema = z.string()
    .transform(normalizeText)
    .pipe(z.string().min(6, "Application ID must be at least 6 characters").max(50).regex(/^[A-Za-z0-9/_-]+$/, "Application ID must be alphanumeric and may include /, _, -"));

export const scholarshipSchemas = {
    getConfig: z.object({
        params: z.object({
            courseId: idSchema
        })
    }),
    getApplicationUrl: z.object({
        params: z.object({
            id: idSchema
        })
    }),
    reverse: z.object({
        params: z.object({
            txnId: idSchema
        })
    }),
    submitApplication: z.object({
        body: z.object({
            application_id: applicationIdSchema
        })
    }),
    updateConfig: z.object({
        body: z.object({
            course_id: z.coerce.number().int().positive(),
            configs: z.array(z.object({
                caste_category: z.enum(STUDENT_CASTE_CATEGORIES),
                gender: z.enum(STUDENT_GENDERS),
                max_amount: z.coerce.number().min(0).max(10000000)
            })).min(1).max(100)
        })
    }),
    reconcile: z.object({
        body: z.object({
            rows: z.array(z.object({
                application_id: z.string().optional(),
                id: z.string().optional(),
                name: z.string().max(150).optional(),
                category: z.string().max(100).optional(),
                caste: z.string().max(100).optional(),
                amount: z.coerce.number().min(0).max(10000000).optional(),
                installment_no: z.coerce.number().int().min(1).max(20).optional(),
                installment: z.coerce.number().int().min(1).max(20).optional()
            }).passthrough()).max(5000).default([])
        })
    }),
    disburse: z.object({
        body: z.object({
            disbursements: z.array(z.object({
                student_id: z.coerce.number().int().positive(),
                amount: z.coerce.number().positive().max(10000000),
                installment_no: z.coerce.number().int().min(1).max(20),
                application_id: applicationIdSchema,
                academic_year_num: z.coerce.number().int().min(1).max(10)
            })).min(1).max(1000)
        })
    })
};
