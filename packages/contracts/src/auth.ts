import { z } from "zod";

export const RegisterInputSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .trim()
    .toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().min(1, "Name is required").trim().max(100),
  avatarUrl: z.string().url().optional(),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .trim()
    .toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RefreshTokenInputSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required").optional(),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenInputSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const AuthResponseDataSchema = z.object({
  user: UserProfileSchema,
});

export type AuthResponseData = z.infer<typeof AuthResponseDataSchema>;
