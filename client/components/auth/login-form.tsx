"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BANNED_AUTH_ERROR,
  BANNED_USER_MESSAGE,
} from "@/lib/access-control";

function getAuthErrorMessage(errorCode?: string | null) {
  if (errorCode === BANNED_AUTH_ERROR) {
    return BANNED_USER_MESSAGE;
  }

  if (
    errorCode === "OAuthSignin" ||
    errorCode === "OAuthCallback" ||
    errorCode === "OAuthCreateAccount" ||
    errorCode === "OAuthAccountNotLinked"
  ) {
    return "Не удалось выполнить вход через Google.";
  }

  if (errorCode === "CredentialsSignin") {
    return "Неверный email или пароль.";
  }

  return "";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M21.805 12.225c0-.782-.07-1.532-.2-2.25H12v4.259h5.49a4.695 4.695 0 0 1-2.038 3.082v2.559h3.296c1.928-1.775 3.057-4.393 3.057-7.65Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.074-.915 6.765-2.476l-3.296-2.559c-.915.614-2.086.977-3.469.977-2.663 0-4.921-1.797-5.728-4.214H2.864v2.64A10.22 10.22 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.272 13.728A6.14 6.14 0 0 1 5.952 12c0-.6.109-1.182.32-1.728v-2.64H2.864A10.02 10.02 0 0 0 1.8 12c0 1.6.384 3.115 1.064 4.368l3.408-2.64Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.057c1.502 0 2.851.516 3.913 1.528l2.934-2.934C17.069 2.996 14.755 2 12 2a10.22 10.22 0 0 0-9.136 5.632l3.408 2.64C7.079 7.854 9.337 6.057 12 6.057Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const authErrorMessage = getAuthErrorMessage(searchParams.get("error"));
  const callbackUrl = searchParams.get("callbackUrl") ?? "/profile";
  const isBusy = isSubmitting || isGoogleSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        throw new Error(
          getAuthErrorMessage(result?.error) || "Неверный email или пароль.",
        );
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

  async function handleGoogleSignIn() {
    setErrorMessage("");
    setIsGoogleSubmitting(true);

    try {
      await signIn("google", {
        callbackUrl,
      });
    } catch {
      setErrorMessage("Не удалось выполнить вход через Google.");
      setIsGoogleSubmitting(false);
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

      <div className="mt-8 space-y-4">
        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isBusy}
          className="h-14 w-full rounded-[1.35rem] bg-white text-base font-semibold text-zinc-950 shadow-[0_18px_42px_rgba(255,255,255,0.12)] hover:bg-zinc-100"
        >
          <GoogleIcon />
          {isGoogleSubmitting ? "Переходим в Google..." : "Войти через Google"}
        </Button>

        <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.24em] uppercase text-zinc-500">
          <span className="h-px flex-1 bg-white/10" />
          или по email
          <span className="h-px flex-1 bg-white/10" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <label className="block space-y-2.5">
          <span className="text-sm font-semibold text-zinc-200">Email</span>
          <Input
            type="email"
            name="email"
            id="email"
            autoComplete="email"
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
            name="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Минимум 6 символов"
            className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            required
          />
        </label>

        {errorMessage || authErrorMessage ? (
          <div className="rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
            {errorMessage || authErrorMessage}
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={isBusy}
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
