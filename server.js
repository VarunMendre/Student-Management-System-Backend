import express from "express";
import cors from "cors";                          
import departmentRoutes from "./routes/departmentRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import batchRoutes from "./routes/batchRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";

import scholarshipRoutes from "./routes/scholarshipRoutes.js";

const app = express();
app.use(cors({
    origin: 'http://localhost:5173',             
    credentials: true,                           
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.get("/", (req, res) => {
    res.send("PostgreSQL + Express API is running Hello World!");
});

app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/batches", batchRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/scholarship", scholarshipRoutes);

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