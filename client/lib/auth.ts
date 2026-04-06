import type { Role } from "@prisma/client";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { BANNED_AUTH_ERROR } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
          select: {
            id: true,
            email: true,
            password: true,
            role: true,
            isBanned: true,
          },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await compare(password, user.password);

        if (!isPasswordValid) {
          return null;
        }

        if (user.isBanned) {
          throw new Error(BANNED_AUTH_ERROR);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.email.split("@")[0],
          role: user.role,
          isBanned: user.isBanned,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }

      const userId =
        user?.id ??
        (typeof token.id === "string" ? token.id : undefined) ??
        token.sub;

      if (!userId) {
        return token;
      }

      const dbUser = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          role: true,
          isBanned: true,
        },
      });

      if (dbUser) {
        token.role = dbUser.role;
        token.isBanned = dbUser.isBanned;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.role = (token.role as Role | undefined) ?? "USER";
        session.user.isBanned = Boolean(token.isBanned);
      }

      return session;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
