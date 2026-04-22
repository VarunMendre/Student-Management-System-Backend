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

const router = express.Router();

router.get("/check-email", checkEmailExists);
router.get("/", authorizeRoles("principal"), getAllUsers);
router.post("/", authorizeRoles("principal"), createUser);
router.patch("/:id/role", authorizeRoles("principal"), updateUserRole);
router.patch("/:id/deactivate", authorizeRoles("principal"), deactivateUser);
router.patch("/:id/recover", authorizeRoles("principal"), recoverUser);
router.delete("/:id", authorizeRoles("principal"), deleteUser);
router.delete("/:id/session", authorizeRoles("principal"), forceLogout);

export default router;
