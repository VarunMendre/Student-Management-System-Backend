import express from "express";
import { 
    getAllCourses, 
    getCourseById, 
    createCourse, 
    updateCourse, 
    deleteCourse 
} from "../controllers/courseController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authorizeRoles("principal", "accountant", "admin"), getAllCourses);
router.get("/:id", authorizeRoles("principal", "accountant", "admin"), getCourseById);
router.post("/", authorizeRoles("principal", "accountant"), createCourse);
router.put("/:id", authorizeRoles("principal", "accountant"), updateCourse);
router.delete("/:id", authorizeRoles("principal", "accountant"), deleteCourse);

export default router;
