import { randomBytes } from "node:crypto";

import { sendVerificationEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const EMAIL_VERIFICATION_TEST_USER = "sefexius@gmail.com";

export function isEmailVerificationTestUser(
  email: string | null | undefined,
) {
  return email?.trim().toLowerCase() === EMAIL_VERIFICATION_TEST_USER;
}

function createVerificationTokenValue() {
  return randomBytes(32).toString("hex");
}

export async function sendVerificationEmailToUser(userId: string) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  });

  if (!user) {
    throw new Error("Пользователь не найден.");
  }

  if (user.emailVerified) {
    return {
      status: "already-verified" as const,
      email: user.email,
    };
  }

  if (!isEmailVerificationTestUser(user.email)) {
    return {
      status: "skipped-test-mode" as const,
      email: user.email,
    };
  }

  const token = createVerificationTokenValue();
  const expires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await prisma.$transaction(async (transactionClient) => {
    await transactionClient.verificationToken.deleteMany({
      where: {
        identifier: user.email,
      },
    });

    await transactionClient.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires,
      },
    });
  });

  await sendVerificationEmail(user.email, token);

  return {
    status: "sent" as const,
    email: user.email,
    expires,
  };
}

export async function verifyEmailToken(token: string) {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return {
      status: "invalid" as const,
    };
  }

  const verificationToken = await prisma.verificationToken.findUnique({
    where: {
      token: normalizedToken,
    },
  });

  if (!verificationToken) {
    return {
      status: "invalid" as const,
    };
  }

  if (verificationToken.expires.getTime() <= Date.now()) {
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: verificationToken.identifier,
      },
    });

    return {
      status: "expired" as const,
      email: verificationToken.identifier,
    };
  }

  const verifiedAt = new Date();

  const user = await prisma.user.findUnique({
    where: {
      email: verificationToken.identifier,
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: verificationToken.identifier,
      },
    });

    return {
      status: "invalid" as const,
    };
  }

  await prisma.$transaction(async (transactionClient) => {
    await transactionClient.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: verifiedAt,
      },
    });

    await transactionClient.verificationToken.deleteMany({
      where: {
        identifier: verificationToken.identifier,
      },
    });
  });

  return {
    status: "success" as const,
    email: user.email,
    verifiedAt,
  };
}