"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const registerPayload = (await registerResponse.json().catch(() => null)) as
        | { message?: string; error?: string }
        | { id: string; email: string }
        | null;

      if (!registerResponse.ok) {
        throw new Error(
          (registerPayload && "message" in registerPayload && registerPayload.message) ||
            (registerPayload && "error" in registerPayload && registerPayload.error) ||
            "Не удалось зарегистрироваться.",
        );
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/profile",
      });

      if (!signInResult || signInResult.error) {
        throw new Error("Аккаунт создан, но автоматический вход не выполнен.");
      }

      router.push(signInResult.url ?? "/profile");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось зарегистрироваться.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-[2rem] border border-white/5 bg-[#1A1D24] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl md:p-8">
      <div>
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-[#8bffb3]">
          Account Setup
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Регистрация в SafeLoot
        </h1>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Создайте аккаунт продавца или покупателя, чтобы публиковать товары, оплачивать заказы и работать с escrow-сделками.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block space-y-2.5">
          <span className="text-sm font-semibold text-zinc-200">Email</span>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="border-white/10 bg-white/[0.04] text-zinc-100 placeholder:text-zinc-500 focus:border-[#00C853]/45 focus:bg-white/[0.07]"
            required
          />
        </label>

        <label className="block space-y-2.5">
          <span className="text-sm font-semibold text-zinc-200">Пароль</span>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Минимум 6 символов"
            className="border-white/10 bg-white/[0.04] text-zinc-100 placeholder:text-zinc-500 focus:border-[#00C853]/45 focus:bg-white/[0.07]"
            required
          />
        </label>

        {errorMessage ? (
          <div className="rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-14 w-full rounded-[1.35rem] border border-[#00C853]/35 bg-[#00C853] text-base font-semibold text-[#0A0D14] shadow-[0_18px_42px_rgba(0,200,83,0.24)] hover:bg-[#00B04A]"
        >
          {isSubmitting ? "Создаем аккаунт..." : "Зарегистрироваться"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-zinc-400">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-semibold text-[#8bffb3] transition hover:text-[#ecfff3]">
          Войти
        </Link>
      </p>
    </section>
  );
}
