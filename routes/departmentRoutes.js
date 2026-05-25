import express from "express";
import { getAllDepartments, getDepartmentById, createDepartment, updateDepartment, deleteDepartment } from "../controllers/departmentController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../validators/index.js";
import { departmentSchemas } from "../validators/department/departmentSchema.js";
import { rateLimiters } from "../config/securityConfig.js";

const router = express.Router();

// CRUD Operations for Departments
router.get("/", authorizeRoles("principal", "accountant", "admin", "student"), rateLimiters.catalogRead, getAllDepartments);
router.get("/:id", authorizeRoles("principal", "accountant", "admin", "student"), rateLimiters.catalogRead, validate(departmentSchemas.byId), getDepartmentById);

router.post("/", authorizeRoles("principal"), rateLimiters.catalogWrite, validate(departmentSchemas.create), createDepartment);
router.put("/:id", authorizeRoles("principal"), rateLimiters.catalogWrite, validate(departmentSchemas.update), updateDepartment);
router.delete("/:id", authorizeRoles("principal"), rateLimiters.catalogWrite, validate(departmentSchemas.byId), deleteDepartment);

export default router;
