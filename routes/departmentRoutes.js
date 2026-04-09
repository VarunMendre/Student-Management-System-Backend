import express from "express";
import { getAllDepartments, getDepartmentById, createDepartment, updateDepartment, deleteDepartment } from "../controllers/departmentController.js";
import { validate } from "../validators/index.js";
import { departmentSchemas } from "../validators/department/departmentSchema.js";

const router = express.Router();

// CRUD Operations for Departments
router.get("/", getAllDepartments);
router.get("/:id", validate(departmentSchemas.byId), getDepartmentById);

router.post("/", validate(departmentSchemas.create), createDepartment);
router.put("/:id", validate(departmentSchemas.update), updateDepartment);
router.delete("/:id", validate(departmentSchemas.byId), deleteDepartment);

export default router;
