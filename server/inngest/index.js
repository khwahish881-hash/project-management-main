
import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";

export const inngest = new Inngest({
    id: "project-management",
});

// --------------------------------------------------
// HELPER 1: Get user information from Clerk
// --------------------------------------------------

const getUserDetails = (data) => {
    const primaryEmail = data.email_addresses?.find(
        (email) => email.id === data.primary_email_address_id
    );

    const email =
        primaryEmail?.email_address ||
        data.email_addresses?.[0]?.email_address;

    if (!email) {
        throw new Error(
            `No email address found for Clerk user ${data.id}`
        );
    }

    return {
        id: data.id,
        email,
        name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || email,
        image: data.image_url || "",
    };
};

// --------------------------------------------------
// HELPER 2: Create or update user in PostgreSQL
// --------------------------------------------------

const syncUserInDatabase = async (data) => {
    const user = getUserDetails(data);

    return await prisma.user.upsert({
        where: {
            id: user.id,
        },
        create: user,
        update: {
            email: user.email,
            name: user.name,
            image: user.image,
        },
    });
};

// --------------------------------------------------
// HELPER 3: Ensure user exists before workspace creation
// --------------------------------------------------

const ensureUserExists = async (userId) => {

    if (!userId) {
        throw new Error("Workspace owner Clerk user ID is missing");
    }

    // First check PostgreSQL
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (existingUser) {
        return existingUser;
    }

    console.log(
        `User ${userId} not found in database. Fetching from Clerk...`
    );

    // Get missing user directly from Clerk
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
        throw new Error("CLERK_SECRET_KEY is missing from environment variables");
    }

    const response = await fetch(
        `https://api.clerk.com/v1/users/${userId}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${secretKey}`,
                "Content-Type": "application/json",
            },
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `Failed to fetch Clerk user: ${response.status} ${errorText}`
        );
    }

    const clerkUser = await response.json();

    // Save user before creating workspace
    const savedUser = await syncUserInDatabase(clerkUser);

    console.log("User successfully synchronized:", savedUser.id);

    return savedUser;
};

// --------------------------------------------------
// 1. SYNC USER CREATION
// --------------------------------------------------

const syncUserCreation = inngest.createFunction(
    {
        id: "sync-user-from-clerk",
        triggers: {
            event: "clerk/user.created",
        },
    },
    async ({ event }) => {

        const { data } = event;

        const user = await syncUserInDatabase(data);

        console.log("User created successfully:", user.id);

        return {
            success: true,
            userId: user.id,
        };
    }
);

// --------------------------------------------------
// 2. SYNC USER DELETION
// --------------------------------------------------

const syncUserDeletion = inngest.createFunction(
    {
        id: "delete-user-with-clerk",
        triggers: {
            event: "clerk/user.deleted",
        },
    },
    async ({ event }) => {

        const { data } = event;

        await prisma.user.deleteMany({
            where: {
                id: data.id,
            },
        });

        console.log("User deleted:", data.id);

        return {
            success: true,
        };
    }
);

// --------------------------------------------------
// 3. SYNC USER UPDATION
// --------------------------------------------------

const syncUserUpdation = inngest.createFunction(
    {
        id: "update-user-from-clerk",
        triggers: {
            event: "clerk/user.updated",
        },
    },
    async ({ event }) => {

        const { data } = event;

        const user = await syncUserInDatabase(data);

        console.log("User updated:", user.id);

        return {
            success: true,
        };
    }
);

// --------------------------------------------------
// 4. SYNC WORKSPACE CREATION
// --------------------------------------------------

const syncWorkspaceCreation = inngest.createFunction(
    {
        id: "sync-workspace-from-clerk",
        triggers: {
            event: "clerk/organization.created",
        },
    },
    async ({ event }) => {

        const { data } = event;

        const ownerId = data.created_by;

        console.log("Workspace creation started:", data.id);
        console.log("Workspace owner:", ownerId);

        if (!data.id || !data.name || !data.slug) {
            throw new Error(
                "Organization ID, name or slug is missing"
            );
        }

        // IMPORTANT:
        // Ensure owner exists before creating workspace.
        const owner = await ensureUserExists(ownerId);

        // Create workspace and admin membership together.
        const workspace = await prisma.$transaction(async (tx) => {

            const createdWorkspace = await tx.workspace.upsert({
                where: {
                    id: data.id,
                },

                create: {
                    id: data.id,
                    name: data.name,
                    slug: data.slug,
                    ownerId: owner.id,
                    image_url: data.image_url || "",
                },

                update: {
                    name: data.name,
                    slug: data.slug,
                    ownerId: owner.id,
                    image_url: data.image_url || "",
                },
            });

            // Add creator as ADMIN.
            await tx.workspaceMember.upsert({
                where: {
                    userId_workspaceId: {
                        userId: owner.id,
                        workspaceId: data.id,
                    },
                },

                create: {
                    userId: owner.id,
                    workspaceId: data.id,
                    role: "ADMIN",
                },

                update: {
                    role: "ADMIN",
                },
            });

            return createdWorkspace;
        });

        console.log(
            "Workspace successfully created:",
            workspace.id
        );

        return {
            success: true,
            workspaceId: workspace.id,
            ownerId: owner.id,
        };
    }
);

// --------------------------------------------------
// 5. SYNC WORKSPACE UPDATION
// --------------------------------------------------

const syncWorkspaceUpdation = inngest.createFunction(
    {
        id: "update-workspace-from-clerk",
        triggers: {
            event: "clerk/organization.updated",
        },
    },
    async ({ event }) => {

        const { data } = event;

        const workspace = await prisma.workspace.update({
            where: {
                id: data.id,
            },

            data: {
                name: data.name,
                slug: data.slug,
                image_url: data.image_url || "",
            },
        });

        console.log("Workspace updated:", workspace.id);

        return {
            success: true,
        };
    }
);

// --------------------------------------------------
// 6. SYNC WORKSPACE DELETION
// --------------------------------------------------

const syncWorkspaceDeletion = inngest.createFunction(
    {
        id: "delete-workspace-with-clerk",
        triggers: {
            event: "clerk/organization.deleted",
        },
    },
    async ({ event }) => {

        const { data } = event;

        await prisma.workspace.deleteMany({
            where: {
                id: data.id,
            },
        });

        console.log("Workspace deleted:", data.id);

        return {
            success: true,
        };
    }
);

// --------------------------------------------------
// 7. SYNC WORKSPACE MEMBER CREATION
// --------------------------------------------------

const syncWorkspaceMemberCreation = inngest.createFunction(
    {
        id: "sync-workspace-member-from-clerk",
        triggers: {
            event: "clerk/organizationInvitation.accepted",
        },
    },
    async ({ event }) => {

        const { data } = event;

        const userId =
            data.public_user_data?.user_id ||
            data.user_id;

        const workspaceId = data.organization_id;

        if (!userId || !workspaceId) {
            throw new Error(
                "Workspace member user ID or organization ID is missing"
            );
        }

        // Ensure invited user exists.
        const user = await ensureUserExists(userId);

        // Convert Clerk organization role to Prisma enum.
        const role = String(data.role || "").toLowerCase().includes("admin")
            ? "ADMIN"
            : "MEMBER";

        const member = await prisma.workspaceMember.upsert({
            where: {
                userId_workspaceId: {
                    userId: user.id,
                    workspaceId,
                },
            },

            create: {
                userId: user.id,
                workspaceId,
                role,
            },

            update: {
                role,
            },
        });

        console.log("Workspace member synchronized:", member.id);

        return {
            success: true,
            memberId: member.id,
        };
    }
);

// --------------------------------------------------
// EXPORT ALL FUNCTIONS
// --------------------------------------------------

export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    syncWorkspaceCreation,
    syncWorkspaceUpdation,
    syncWorkspaceDeletion,
    syncWorkspaceMemberCreation,
];
