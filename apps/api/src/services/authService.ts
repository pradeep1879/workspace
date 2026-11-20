import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma, WorkspaceRole } from "@collab/db";
import {
  RegisterInput,
  LoginInput,
  UserProfile,
  ErrorCode,
} from "@collab/contracts";
import { config } from "../config.js";
import { AppError } from "../middleware/errorHandler.js";

export type TokenPayload = {
  userId: string;
  email: string;
  name: string;
  sessionId: string;
};

type AuthenticatedSessionResult = {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
};

export class AuthService {
  private hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }

  private generateAccessToken(
    user: { id: string; email: string; name: string },
    sessionId: string,
  ): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      sessionId,
    };
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as any,
    });
  }

  private async createSession(
    userId: string,
  ): Promise<{ id: string; refreshToken: string }> {
    const rawRefreshToken = crypto.randomBytes(40).toString("hex");
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { id: session.id, refreshToken: rawRefreshToken };
  }

  private toUserProfile(user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async register(input: RegisterInput): Promise<AuthenticatedSessionResult> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new AppError(
        409,
        ErrorCode.CONFLICT,
        "An account with this email address already exists",
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          name: input.name,
          avatarUrl:
            input.avatarUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.name)}`,
        },
      });

      // Automatically create a personal default workspace for the user
      const workspace = await tx.workspace.create({
        data: {
          name: `${input.name}'s Workspace`,
          ownerId: newUser.id,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: newUser.id,
          role: WorkspaceRole.OWNER,
        },
      });

      // Create a welcoming first page
      await tx.page.create({
        data: {
          workspaceId: workspace.id,
          creatorId: newUser.id,
          title: "Getting Started",
          icon: "👋",
          position: 1000,
        },
      });

      return newUser;
    });

    const { id: sessionId, refreshToken } = await this.createSession(user.id);
    const accessToken = this.generateAccessToken(user, sessionId);

    return {
      user: this.toUserProfile(user),
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput): Promise<AuthenticatedSessionResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new AppError(
        401,
        ErrorCode.UNAUTHORIZED,
        "Invalid email or password",
      );
    }

    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new AppError(
        401,
        ErrorCode.UNAUTHORIZED,
        "Invalid email or password",
      );
    }

    const { id: sessionId, refreshToken } = await this.createSession(user.id);
    const accessToken = this.generateAccessToken(user, sessionId);

    return {
      user: this.toUserProfile(user),
      accessToken,
      refreshToken,
    };
  }

  async refresh(
    refreshTokenRaw?: string,
  ): Promise<{ accessToken: string; user: UserProfile }> {
    if (!refreshTokenRaw) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "Refresh token required");
    }

    const tokenHash = this.hashToken(refreshTokenRaw);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new AppError(
        401,
        ErrorCode.UNAUTHORIZED,
        "Session has expired or been revoked",
      );
    }

    const accessToken = this.generateAccessToken(session.user, session.id);
    return {
      accessToken,
      user: this.toUserProfile(session.user),
    };
  }

  async logout(refreshTokenRaw?: string): Promise<void> {
    if (!refreshTokenRaw) return;
    const tokenHash = this.hashToken(refreshTokenRaw);
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "User not found");
    }

    return this.toUserProfile(user);
  }
}

export const authService = new AuthService();
