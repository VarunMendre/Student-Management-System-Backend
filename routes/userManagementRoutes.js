import express from "express";
import {
    createUser,
    deactivateUser,
    deleteUser,
    forceLogout,
    getAllUsers,
    recoverUser,
    updateUserRole,
    checkEmailExists
} from "../controllers/userManagementController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { rateLimiters, throttlers } from "../config/securityConfig.js";
import { validate } from "../validators/index.js";
import { userManagementSchemas } from "../validators/userManagement/userManagementSchema.js";

const router = express.Router();

router.get("/check-email", rateLimiters.checkEmail, throttlers.checkEmail, validate(userManagementSchemas.checkEmail), checkEmailExists);
router.get("/", authorizeRoles("principal"), rateLimiters.adminRead, getAllUsers);
router.post("/", authorizeRoles("principal"), rateLimiters.adminWrite, throttlers.adminWrite, validate(userManagementSchemas.create), createUser);
router.patch("/:id/role", authorizeRoles("principal"), rateLimiters.adminWrite, throttlers.adminWrite, validate(userManagementSchemas.updateRole), updateUserRole);
router.patch("/:id/deactivate", authorizeRoles("principal"), rateLimiters.adminWrite, throttlers.adminWrite, validate(userManagementSchemas.byId), deactivateUser);
router.patch("/:id/recover", authorizeRoles("principal"), rateLimiters.adminWrite, throttlers.adminWrite, validate(userManagementSchemas.byId), recoverUser);
router.delete("/:id", authorizeRoles("principal"), rateLimiters.adminWrite, throttlers.adminWrite, validate(userManagementSchemas.byId), deleteUser);
router.delete("/:id/session", authorizeRoles("principal"), rateLimiters.adminWrite, throttlers.adminWrite, validate(userManagementSchemas.byId), forceLogout);

export default router;
