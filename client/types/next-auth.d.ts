import type { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      isBanned: boolean;
      image?: string | null;
      name?: string | null;
    };
  }

  interface User {
    id: string;
    role: Role;
    isBanned: boolean;
    image?: string | null;
    name?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    isBanned?: boolean;
    picture?: string | null;
    name?: string | null;
  }
}
