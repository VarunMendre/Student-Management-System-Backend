import { z } from "zod";
import { normalizeEmail, normalizePhone, normalizeText } from "../../utils/studentOptions.js";

const idSchema = z.string().regex(/^\d+$/, "Invalid user ID format");
const creatableRoles = ["accountant", "admin"];
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\d{10,15}$/;

export const userManagementSchemas = {
    checkEmail: z.object({
        query: z.object({
            email: z.string().transform(normalizeEmail).pipe(
                z.string().regex(emailRegex, "Enter a valid email address").max(150)
            )
        })
    }),
    create: z.object({
        body: z.object({
            name: z.string().transform(normalizeText).pipe(z.string().min(2).max(150)),
            email: z.string().transform(normalizeEmail).pipe(
                z.string().regex(emailRegex, "Enter a valid email address").max(150)
            ),
            contact_number: z.string().transform(normalizePhone).pipe(
                z.string().regex(phoneRegex, "Enter a valid contact number")
            ),
            role: z.enum(creatableRoles)
        })
    }),
    byId: z.object({
        params: z.object({
            id: idSchema
        })
    }),
    updateRole: z.object({
        params: z.object({
            id: idSchema
        }),
        body: z.object({
            role: z.enum(creatableRoles)
        })
    })
};
