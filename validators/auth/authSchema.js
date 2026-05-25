import { z } from "zod";
import { normalizeEmail, normalizePhone, normalizeText } from "../../utils/studentOptions.js";

const roleValues = ["principal", "accountant", "admin", "student"];
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\d{10,15}$/;

const normalizedEmailSchema = z.string().transform(normalizeEmail).pipe(
    z.string().regex(emailRegex, "Enter a valid email address").max(150)
);

const normalizedPhoneSchema = z.string().transform(normalizePhone).pipe(
    z.string().regex(phoneRegex, "Enter a valid contact number")
);

const normalizedNameSchema = z.string().transform(normalizeText).pipe(
    z.string().min(2, "Name must be at least 2 characters").max(150)
);

export const authSchemas = {
    login: z.object({
        body: z.object({
            email: normalizedEmailSchema,
            password: z.string().min(8, "Password must be at least 8 characters").max(200),
            role: z.enum(roleValues)
        })
    }),
    refresh: z.object({
        body: z.object({
            refreshToken: z.string().min(20).max(2048).optional()
        }).optional().default({})
    }),
    updateMe: z.object({
        body: z.object({
            name: normalizedNameSchema,
            email: normalizedEmailSchema,
            contact_number: normalizedPhoneSchema
        })
    }),
    resetPassword: z.object({
        body: z.object({
            currentPassword: z.string().min(8).max(200).optional(),
            newPassword: z.string()
                .min(12, "New password must be at least 12 characters")
                .max(200)
                .regex(/[A-Z]/, "New password must contain at least one uppercase letter")
                .regex(/[a-z]/, "New password must contain at least one lowercase letter")
                .regex(/[0-9]/, "New password must contain at least one number")
                .regex(/[^A-Za-z0-9]/, "New password must contain at least one special character")
        })
    })
};
