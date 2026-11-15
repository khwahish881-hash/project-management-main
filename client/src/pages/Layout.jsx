
import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import {
    useAuth,
    useUser,
    useOrganization,
    SignIn,
    CreateOrganization
} from "@clerk/clerk-react";

import { Loader2Icon } from "lucide-react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

import { loadTheme } from "../features/themeSlice";
import { fetchWorkspaces } from "../features/workspaceSlice";

const Layout = () => {

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const dispatch = useDispatch();

    // Redux state
    const { loading, workspaces, error } = useSelector(
        (state) => state.workspace
    );

    // Clerk authentication
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const { organization, isLoaded: organizationLoaded } = useOrganization();

    // Load theme
    useEffect(() => {
        dispatch(loadTheme());
    }, [dispatch]);

    // Fetch workspaces after login or organization change
    useEffect(() => {

        if (!isLoaded || !user || !organizationLoaded) return;

        let cancelled = false;

        const loadUserWorkspaces = async () => {
            try {
                const token = await getToken();

                if (!cancelled && token) {
                    dispatch(fetchWorkspaces(token));
                }

            } catch (err) {
                console.error("Workspace loading error:", err);
            }
        };

        loadUserWorkspaces();

        return () => {
            cancelled = true;
        };

    }, [isLoaded, user, organization, organizationLoaded, getToken, dispatch]);

    // Wait for Clerk
    if (!isLoaded || !organizationLoaded) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
            </div>
        );
    }

    // Show login
    if (!user) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
                <SignIn />
            </div>
        );
    }

    // Show workspace loading
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
            </div>
        );
    }

    // No workspace: create organization
    if (workspaces.length === 0 && !organization) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
                <CreateOrganization
                    afterCreateOrganizationUrl="/"
                />
            </div>
        );
    }

    // Organization exists but database workspace is not ready
    if (workspaces.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 h-screen bg-white dark:bg-zinc-950">
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
                <p className="text-gray-600 dark:text-gray-300">
                    Setting up your workspace...
                </p>
                <p className="text-sm text-gray-400">
                    Please wait while your workspace is being synchronized.
                </p>
            </div>
        );
    }

    // Main dashboard
    return (
        <div className="flex min-h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">

            <Sidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
            />

            <div className="flex-1 flex flex-col h-screen min-w-0">

                <Navbar
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                />

                <main className="flex-1 p-6 xl:p-10 xl:px-16 overflow-y-auto">
                    <Outlet />
                </main>

            </div>
        </div>
    );
};

export default Layout;
