import { z } from "zod";

export const PagePermissionLevel = {
  VIEW: "VIEW",
  COMMENT: "COMMENT",
  EDIT: "EDIT",
} as const;

export type PagePermissionLevelType =
  (typeof PagePermissionLevel)[keyof typeof PagePermissionLevel];

export const PagePermissionLevelSchema = z.nativeEnum(PagePermissionLevel);

export const CreatePageSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200)
    .trim()
    .default("Untitled"),
  parentId: z.string().nullable().optional(),
  icon: z.string().optional(),
});

export type CreatePageInput = z.infer<typeof CreatePageSchema>;

export const UpdatePageSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  icon: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
});

export type UpdatePageInput = z.infer<typeof UpdatePageSchema>;

export const MovePageSchema = z.object({
  targetParentId: z.string().nullable(),
  position: z.number().int().nonnegative().optional(),
});

export type MovePageInput = z.infer<typeof MovePageSchema>;

export const SetPagePermissionSchema = z.object({
  userId: z.string(),
  permission: PagePermissionLevelSchema,
});

export type SetPagePermissionInput = z.infer<typeof SetPagePermissionSchema>;

export const PageSummarySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  parentId: z.string().nullable(),
  title: z.string(),
  icon: z.string().nullable().optional(),
  position: z.number(),
  isArchived: z.boolean(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  creatorId: z.string(),
  effectivePermission: PagePermissionLevelSchema.optional(),
});

export type PageSummary = z.infer<typeof PageSummarySchema>;

export const PageTreeNodeSchema: z.ZodType<any> = PageSummarySchema.extend({
  children: z.lazy(() => z.array(PageTreeNodeSchema)),
});

export type PageTreeNode = PageSummary & {
  children: PageTreeNode[];
};
