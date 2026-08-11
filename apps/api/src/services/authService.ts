import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@ml-ims/db";
import {
  AppError,
  CreateUserInput,
  LoginInput,
  ResetPasswordInput,
  UpdateUserInput,
  UserRole,
  type UserRole as UserRoleType,
} from "@ml-ims/shared";
import type { AuthUser } from "../types/express.js";

const TOKEN_TTL = process.env.JWT_EXPIRES_IN ?? "12h";
const BCRYPT_ROUNDS = 12;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new AppError(
      "JWT_SECRET must be set to a string of at least 16 characters",
      500,
      "AUTH_MISCONFIGURED",
    );
  }
  return secret;
}

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  role: UserRoleType;
  fullName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toPublicUser(user: {
  id: string;
  username: string;
  email: string;
  role: string;
  fullName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: UserRole.parse(user.role),
    fullName: user.fullName,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    },
    jwtSecret(),
    { expiresIn: TOKEN_TTL } as jwt.SignOptions,
  );
}

export function verifyToken(token: string): AuthUser {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
  } catch {
    throw new AppError("Invalid or expired token", 401, "UNAUTHORIZED");
  }

  const id = typeof payload.sub === "string" ? payload.sub : null;
  const username = typeof payload.username === "string" ? payload.username : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  const fullName = typeof payload.fullName === "string" ? payload.fullName : null;
  const roleResult = UserRole.safeParse(payload.role);

  if (!id || !username || !email || !fullName || !roleResult.success) {
    throw new AppError("Invalid token payload", 401, "UNAUTHORIZED");
  }

  return {
    id,
    username,
    email,
    fullName,
    role: roleResult.data,
  };
}

export async function login(input: LoginInput): Promise<{
  token: string;
  user: PublicUser;
}> {
  const user = await prisma.user.findUnique({
    where: { username: input.username },
  });

  if (!user || !user.isActive) {
    throw new AppError("Invalid username or password", 401, "INVALID_CREDENTIALS");
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw new AppError("Invalid username or password", 401, "INVALID_CREDENTIALS");
  }

  const publicUser = toPublicUser(user);
  const token = signToken({
    id: publicUser.id,
    username: publicUser.username,
    email: publicUser.email,
    role: publicUser.role,
    fullName: publicUser.fullName,
  });

  return { token, user: publicUser };
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  if (!user.isActive) {
    throw new AppError("Account is inactive", 401, "UNAUTHORIZED");
  }
  return toPublicUser(user);
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({ orderBy: { username: "asc" } });
  return users.map(toPublicUser);
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: input.username }, { email: input.email }],
    },
  });
  if (existing) {
    throw new AppError(
      "Username or email already exists",
      409,
      "USER_EXISTS",
    );
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role,
    },
  });
  return toPublicUser(user);
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  if (input.email && input.email !== existing.email) {
    const clash = await prisma.user.findUnique({ where: { email: input.email } });
    if (clash) {
      throw new AppError("Email already in use", 409, "USER_EXISTS");
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      isActive: input.isActive,
    },
  });
  return toPublicUser(user);
}

export async function resetPassword(
  userId: string,
  input: ResetPasswordInput,
): Promise<{ ok: true }> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
  return { ok: true };
}
