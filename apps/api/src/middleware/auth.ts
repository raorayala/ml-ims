import type { NextFunction, Request, Response } from "express";
import { AppError, UserRole, type UserRole as UserRoleType } from "@ml-ims/shared";
import { getUserById, verifyToken } from "../services/authService.js";

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/** Require a valid JWT and attach `req.user`. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = extractBearer(req);
    if (!token) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const claims = verifyToken(token);
    // Re-check DB so deactivated users lose access immediately.
    const user = await getUserById(claims.id);
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };
    next();
  } catch (e) {
    next(e);
  }
}

/** Require one of the listed roles (call after `requireAuth`). */
export function requireRole(...roles: UserRoleType[]) {
  const allowed = new Set(roles.map((r) => UserRole.parse(r)));

  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError("Authentication required", 401, "UNAUTHORIZED");
      }
      if (!allowed.has(req.user.role)) {
        throw new AppError(
          "Insufficient permissions for this action",
          403,
          "FORBIDDEN",
        );
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

export const requireAdmin = requireRole("ADMIN");
