import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Role } from "@prisma/client";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { BANNED_AUTH_ERROR } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function getGoogleProfileData(profile?: Record<string, unknown>) {
  const name =
    typeof profile?.name === "string" && profile.name.trim()
      ? profile.name.trim()
      : undefined;
  const image =
    typeof profile?.picture === "string" && profile.picture.trim()
      ? profile.picture
      : typeof profile?.image === "string" && profile.image.trim()
        ? profile.image
        : undefined;

  return { name, image };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email);
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

        if (!user?.password) {
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
    async signIn({ user }) {
      const email = normalizeEmail(user.email);

      if (!email) {
        return true;
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          isBanned: true,
        },
      });

      if (existingUser?.isBanned) {
        return `/login?error=${BANNED_AUTH_ERROR}`;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = normalizeEmail(user.email);
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
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.id) {
        return;
      }

      const email = normalizeEmail(user.email);
      const { image, name } = getGoogleProfileData(
        profile as Record<string, unknown> | undefined,
      );

      const currentUser = await prisma.user.findUnique({
        where: {
          id: user.id,
        },
        select: {
          image: true,
          name: true,
        },
      });

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          email: email || undefined,
          emailVerified: new Date(),
          image: currentUser?.image ? undefined : image,
          name: currentUser?.name ? undefined : name,
        },
      });
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
