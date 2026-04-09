import express from "express";
import { getAllDepartments, createDepartment, updateDepartment, deleteDepartment } from "../controllers/departmentController.js";

const router = express.Router();

// CRUD Operations for Departments
router.get("/", getAllDepartments);
router.get("/:i", getAllDepartments);

router.post("/", createDepartment);
router.put("/:id", updateDepartment);
router.delete("/:id", deleteDepartment);

export default router;
