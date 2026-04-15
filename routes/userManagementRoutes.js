import express from "express";
import {
    createUser,
    deactivateUser,
    deleteUser,
    forceLogout,
    getAllUsers,
    recoverUser,
    updateUserRole
} from "../controllers/userManagementController.js";

const router = express.Router();

router.get("/", getAllUsers);
router.post("/", createUser);
router.patch("/:id/role", updateUserRole);
router.patch("/:id/deactivate", deactivateUser);
router.patch("/:id/recover", recoverUser);
router.delete("/:id", deleteUser);
router.delete("/:id/session", forceLogout);

export default router;
