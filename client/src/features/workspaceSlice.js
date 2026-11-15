
import axios from "axios";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

// Fetch workspaces
export const fetchWorkspaces = createAsyncThunk(
    "workspace/fetchWorkspaces",
    async (token, { rejectWithValue }) => {
        try {
            const { data } = await api.get("/api/workspaces", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            return data.workspaces || [];

        } catch (error) {
            console.error(
                "Fetch workspaces error:",
                error.response?.data || error.message
            );

            return rejectWithValue(
                error.response?.data?.message || error.message
            );
        }
    }
);

const initialState = {
    workspaces: [],
    currentWorkspace: null,
    loading: false,
    error: null,
};

const workspaceSlice = createSlice({
    name: "workspace",
    initialState,

    reducers: {
        setWorkspaces: (state, action) => {
            state.workspaces = action.payload;
        },

        setCurrentWorkspace: (state, action) => {
            const selectedWorkspace = state.workspaces.find(
                (w) => w.id === action.payload
            );

            state.currentWorkspace = selectedWorkspace || null;

            if (selectedWorkspace) {
                localStorage.setItem(
                    "currentWorkspaceId",
                    selectedWorkspace.id
                );
            }
        },

        addWorkspace: (state, action) => {
            state.workspaces.push(action.payload);
            state.currentWorkspace = action.payload;
        },

        updateWorkspace: (state, action) => {
            state.workspaces = state.workspaces.map((w) =>
                w.id === action.payload.id ? action.payload : w
            );

            if (state.currentWorkspace?.id === action.payload.id) {
                state.currentWorkspace = action.payload;
            }
        },

        deleteWorkspace: (state, action) => {
            state.workspaces = state.workspaces.filter(
                (w) => w.id !== action.payload
            );

            if (state.currentWorkspace?.id === action.payload) {
                state.currentWorkspace = state.workspaces[0] || null;
            }
        },

        addProject: (state, action) => {
            if (!state.currentWorkspace) return;

            state.currentWorkspace.projects ??= [];
            state.currentWorkspace.projects.push(action.payload);

            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id
                    ? {
                        ...w,
                        projects: [
                            ...(w.projects || []),
                            action.payload,
                        ],
                    }
                    : w
            );
        },

        addTask: (state, action) => {
            if (!state.currentWorkspace) return;

            const { projectId } = action.payload;

            state.currentWorkspace.projects =
                (state.currentWorkspace.projects || []).map((p) =>
                    p.id === projectId
                        ? {
                            ...p,
                            tasks: [
                                ...(p.tasks || []),
                                action.payload,
                            ],
                        }
                        : p
                );

            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id
                    ? {
                        ...w,
                        projects: (w.projects || []).map((p) =>
                            p.id === projectId
                                ? {
                                    ...p,
                                    tasks: [
                                        ...(p.tasks || []),
                                        action.payload,
                                    ],
                                }
                                : p
                        ),
                    }
                    : w
            );
        },

        updateTask: (state, action) => {
            if (!state.currentWorkspace) return;

            const { projectId, id } = action.payload;

            state.currentWorkspace.projects =
                (state.currentWorkspace.projects || []).map((p) =>
                    p.id === projectId
                        ? {
                            ...p,
                            tasks: (p.tasks || []).map((t) =>
                                t.id === id ? action.payload : t
                            ),
                        }
                        : p
                );

            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id
                    ? {
                        ...w,
                        projects: (w.projects || []).map((p) =>
                            p.id === projectId
                                ? {
                                    ...p,
                                    tasks: (p.tasks || []).map((t) =>
                                        t.id === id ? action.payload : t
                                    ),
                                }
                                : p
                        ),
                    }
                    : w
            );
        },

        deleteTask: (state, action) => {
            if (!state.currentWorkspace) return;

            // Supports { taskIds: [], projectId: "" }
            // and the previous array payload format.
            const taskIds = Array.isArray(action.payload)
                ? action.payload
                : action.payload.taskIds || [];

            const projectId = Array.isArray(action.payload)
                ? action.payload.projectId
                : action.payload.projectId;

            state.currentWorkspace.projects =
                (state.currentWorkspace.projects || []).map((p) =>
                    !projectId || p.id === projectId
                        ? {
                            ...p,
                            tasks: (p.tasks || []).filter(
                                (t) => !taskIds.includes(t.id)
                            ),
                        }
                        : p
                );

            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id
                    ? {
                        ...w,
                        projects: (w.projects || []).map((p) =>
                            !projectId || p.id === projectId
                                ? {
                                    ...p,
                                    tasks: (p.tasks || []).filter(
                                        (t) => !taskIds.includes(t.id)
                                    ),
                                }
                                : p
                        ),
                    }
                    : w
            );
        },
    },

    extraReducers: (builder) => {
        builder
            .addCase(fetchWorkspaces.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(fetchWorkspaces.fulfilled, (state, action) => {
                state.loading = false;
                state.workspaces = action.payload;

                const savedWorkspaceId =
                    localStorage.getItem("currentWorkspaceId");

                state.currentWorkspace =
                    action.payload.find(
                        (w) => w.id === savedWorkspaceId
                    ) || action.payload[0] || null;
            })

            .addCase(fetchWorkspaces.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            });
    },
});

export const {
    setWorkspaces,
    setCurrentWorkspace,
    addWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addProject,
    addTask,
    updateTask,
    deleteTask,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
