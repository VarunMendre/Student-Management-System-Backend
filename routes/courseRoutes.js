import express from "express";
import { 
    getAllCourses, 
    getCourseById, 
    createCourse, 
    updateCourse, 
    deleteCourse 
} from "../controllers/courseController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { rateLimiters } from "../config/securityConfig.js";
import { validate } from "../validators/index.js";
import { courseSchemas } from "../validators/course/courseSchema.js";

const router = express.Router();

router.get("/", authorizeRoles("principal", "accountant", "admin", "student"), rateLimiters.catalogRead, getAllCourses);
router.get("/:id", authorizeRoles("principal", "accountant", "admin", "student"), rateLimiters.catalogRead, validate(courseSchemas.byId), getCourseById);
router.post("/", authorizeRoles("principal", "accountant"), rateLimiters.catalogWrite, validate(courseSchemas.create), createCourse);
router.put("/:id", authorizeRoles("principal", "accountant"), rateLimiters.catalogWrite, validate(courseSchemas.update), updateCourse);
router.delete("/:id", authorizeRoles("principal", "accountant"), rateLimiters.catalogWrite, validate(courseSchemas.byId), deleteCourse);

export default router;
