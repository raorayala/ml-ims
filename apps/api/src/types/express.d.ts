import type { UserRole } from "@ml-ims/shared";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
