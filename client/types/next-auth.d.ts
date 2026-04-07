import type { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      emailVerified?: string | null;
      role: Role;
      isBanned: boolean;
      platformRevenue: number;
      image?: string | null;
      name?: string | null;
    };
  }

  interface User {
    id: string;
    emailVerified?: string | null;
    role: Role;
    isBanned: boolean;
    platformRevenue: number;
    image?: string | null;
    name?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    emailVerified?: string | null;
    role?: Role;
    isBanned?: boolean;
    platformRevenue?: number;
    picture?: string | null;
    name?: string | null;
  }
}
