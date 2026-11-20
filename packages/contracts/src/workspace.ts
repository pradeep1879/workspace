import { z } from "zod";

export const WorkspaceRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

export type WorkspaceRoleType =
  (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const WorkspaceRoleSchema = z.nativeEnum(WorkspaceRole);

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100).trim(),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100).trim(),
});

export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;

export const InviteMemberSchema = z.object({
  email: z.string().email("Valid email is required").trim().toLowerCase(),
  role: z.enum([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER]).default("MEMBER"),
});

export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
  role: WorkspaceRoleSchema,
});

export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;

export const WorkspaceMemberSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  workspaceId: z.string(),
  role: WorkspaceRoleSchema,
  joinedAt: z.date().or(z.string()),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    avatarUrl: z.string().nullable().optional(),
  }),
});

export type WorkspaceMemberSummary = z.infer<
  typeof WorkspaceMemberSummarySchema
>;

export const WorkspaceDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  role: WorkspaceRoleSchema.optional(),
  _count: z
    .object({
      members: z.number().optional(),
      pages: z.number().optional(),
    })
    .optional(),
});

export type WorkspaceDetail = z.infer<typeof WorkspaceDetailSchema>;
