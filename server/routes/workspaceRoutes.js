
import express from "express";

import {
    addMember,
    getUserWorkspaces
} from "../controllers/workspaceController.js";

const workspaceRouter = express.Router();

// Get all workspaces for the logged-in user
workspaceRouter.get("/", getUserWorkspaces);

// Add a member to a workspace
workspaceRouter.post("/add-member", addMember);

export default workspaceRouter;
