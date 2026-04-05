import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-7xl items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_24%)]" />
      <div className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <section>
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
            Authorization Layer
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-6xl md:leading-[1.02]">
            Управляйте балансом, сделками и товарами из единого аккаунта.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-400 md:text-lg">
            Вход открывает доступ к публикации товаров, покупке через mock checkout, escrow-завершению сделок и личному кабинету продавца.
          </p>
        </section>

        <Suspense fallback={<div className="h-[620px] w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-900/82 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-8" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
