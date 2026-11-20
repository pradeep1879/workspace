import { z } from "zod";

export const CreateSnapshotSchema = z.object({
  label: z.string().max(100).trim().optional(),
});

export type CreateSnapshotInput = z.infer<typeof CreateSnapshotSchema>;

export const SnapshotSummarySchema = z.object({
  id: z.string(),
  pageId: z.string(),
  label: z.string().nullable().optional(),
  preview: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  creatorId: z.string(),
  creator: z.object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable().optional(),
  }),
});

export type SnapshotSummary = z.infer<typeof SnapshotSummarySchema>;

export const RestoreSnapshotResponseSchema = z.object({
  success: z.boolean(),
  pageId: z.string(),
  snapshotId: z.string(),
  restoredAt: z.date().or(z.string()),
});

export type RestoreSnapshotResponse = z.infer<
  typeof RestoreSnapshotResponseSchema
>;
