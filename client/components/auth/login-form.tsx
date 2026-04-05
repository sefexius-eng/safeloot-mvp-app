"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const callbackUrl = searchParams.get("callbackUrl") ?? "/profile";

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        throw new Error("Неверный email или пароль.");
      }

      router.push(result.url ?? callbackUrl);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось выполнить вход.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-900/82 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-8">
      <div>
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-orange-300">
          Secure Login
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Войти в SafeLoot
        </h1>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Используйте email и пароль, чтобы управлять товарами, сделками и балансом в escrow.
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
            className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
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
            className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
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
          className="h-14 w-full rounded-[1.35rem] bg-orange-600 text-base font-semibold shadow-[0_18px_42px_rgba(234,88,12,0.35)] hover:bg-orange-500"
        >
          {isSubmitting ? "Входим..." : "Войти"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-zinc-400">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-semibold text-orange-300 transition hover:text-orange-200">
          Зарегистрироваться
        </Link>
      </p>
    </section>
  );
}
