import express from "express";
import { pool } from "./config/db.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("PostgreSQL + Express API is running");
});

app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/courses", courseRoutes);

// error handling middleware
app.use((err, req, res, next) => {
    console.log(err);
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(statusCode).json({ message });
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Express Server Started Listening on ${PORT}`);
});