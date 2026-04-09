import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import {
  isEmailVerificationTestUser,
  sendVerificationEmailToUser,
} from "@/lib/email-verification";
import {
  ACHIEVEMENT_CODES,
  grantAchievementToUserIfExists,
  runAchievementAutomation,
} from "@/lib/domain/achievements";
import { prisma } from "@/lib/prisma";

interface RegisterRequestBody {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequestBody;
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password?.trim() ?? "";

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { message: "Введите корректный email." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Пароль должен содержать минимум 6 символов." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Пользователь с таким email уже существует." },
        { status: 409 },
      );
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: email.split("@")[0],
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        rank: true,
      },
    });

    if (isEmailVerificationTestUser(user.email)) {
      try {
        await sendVerificationEmailToUser(user.id);
      } catch (error) {
        console.error("[REGISTER_VERIFICATION_EMAIL_ERROR]", error);
      }
    }

    await runAchievementAutomation("register-user", [
      {
        label: "registration-achievement",
        run: () =>
          grantAchievementToUserIfExists({
            userId: user.id,
            achievementCode: ACHIEVEMENT_CODES.REGISTRATION,
            notifyUser: true,
          }),
      },
    ]);

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);

    return NextResponse.json(
      { message: "Не удалось зарегистрировать пользователя." },
      { status: 500 },
    );
  }
}
