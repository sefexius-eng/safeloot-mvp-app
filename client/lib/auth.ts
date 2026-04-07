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
            emailVerified: true,
            name: true,
            image: true,
            password: true,
            role: true,
            isBanned: true,
            platformRevenue: true,
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
          emailVerified: user.emailVerified?.toISOString() ?? null,
          name: user.name ?? user.email.split("@")[0],
          image: user.image,
          role: user.role,
          isBanned: user.isBanned,
          platformRevenue: user.platformRevenue,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.emailVerified =
          typeof user.emailVerified === "string" ? user.emailVerified : null;
        token.name = user.name;
        token.picture = user.image ?? null;
        token.platformRevenue = user.platformRevenue ?? 0;
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
          email: true,
          emailVerified: true,
          name: true,
          image: true,
          role: true,
          isBanned: true,
          platformRevenue: true,
        },
      });

      if (dbUser) {
        token.email = dbUser.email;
        token.emailVerified = dbUser.emailVerified?.toISOString() ?? null;
        token.name = dbUser.name ?? dbUser.email.split("@")[0];
        token.picture = dbUser.image ?? null;
        token.role = dbUser.role;
        token.isBanned = dbUser.isBanned;
        token.platformRevenue = dbUser.platformRevenue;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.email = token.email;
        session.user.emailVerified =
          typeof token.emailVerified === "string" ? token.emailVerified : null;
        session.user.name =
          (typeof token.name === "string" && token.name) ||
          token.email?.split("@")[0] ||
          null;
        session.user.image =
          typeof token.picture === "string" ? token.picture : null;
        session.user.role = (token.role as Role | undefined) ?? "USER";
        session.user.isBanned = Boolean(token.isBanned);
        session.user.platformRevenue =
          typeof token.platformRevenue === "number" ? token.platformRevenue : 0;
      }

      return session;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
