
import "dotenv/config";
import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";

import { inngest, functions } from "./inngest/index.js";
import workspaceRouter from "./routes/workspaceRoutes.js";

const app = express();

// 1. Clerk authentication middleware
app.use(clerkMiddleware());

// 2. CORS configuration
app.use(cors());

// 3. JSON body parser
app.use(express.json());

// 4. Home route
app.get("/", (req, res) => {
    res.status(200).send("Server is live!");
});

// 5. Inngest endpoint
app.use(
    "/api/inngest",
    serve({
        client: inngest,
        functions: functions,
    })
);

// 6. Workspace routes
app.use("/api/workspaces", workspaceRouter);

// 7. Health check route
app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Backend is running successfully",
    });
});

// 8. Server port
const PORT = process.env.PORT || 5000;

// 9. Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
