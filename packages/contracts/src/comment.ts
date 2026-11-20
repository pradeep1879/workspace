import { z } from "zod";

export const CommentAnchorSchema = z
  .object({
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
    text: z.string().optional(),
  })
  .refine((anchor) => anchor.to >= anchor.from, {
    message: "Anchor end must be after its start",
    path: ["to"],
  });

export type CommentAnchor = z.infer<typeof CommentAnchorSchema>;

export const CreateCommentSchema = z.object({
  content: z.string().min(1, "Comment text cannot be empty").trim().max(5000),
  anchor: CommentAnchorSchema.optional(),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const ReplyCommentSchema = z.object({
  content: z.string().min(1, "Reply text cannot be empty").trim().max(5000),
});

export type ReplyCommentInput = z.infer<typeof ReplyCommentSchema>;

export const UpdateCommentSchema = z
  .object({
    content: z.string().min(1).trim().max(5000).optional(),
    isResolved: z.boolean().optional(),
  })
  .refine(
    (input) => input.content !== undefined || input.isResolved !== undefined,
    { message: "At least one comment field must be provided" },
  );

export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>;

export const CommentReplySchema = z.object({
  id: z.string(),
  commentId: z.string(),
  authorId: z.string(),
  content: z.string(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  author: z.object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable().optional(),
  }),
});

export type CommentReply = z.infer<typeof CommentReplySchema>;

export const CommentSchema = z.object({
  id: z.string(),
  pageId: z.string(),
  authorId: z.string(),
  content: z.string(),
  anchor: CommentAnchorSchema.nullable().optional(),
  isResolved: z.boolean(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  author: z.object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable().optional(),
  }),
  replies: z.array(CommentReplySchema).optional(),
});

export type CommentItem = z.infer<typeof CommentSchema>;
