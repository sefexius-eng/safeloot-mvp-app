import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-7xl items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_24%)]" />
      <div className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <section>
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
            Create Identity
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-6xl md:leading-[1.02]">
            Создайте профиль и подключитесь к реальным пользовательским данным.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-400 md:text-lg">
            После регистрации вы получите собственный баланс, сможете публиковать товары от своего имени и видеть сделки без тестовых заглушек пользователя.
          </p>
        </section>

        <RegisterForm />
      </div>
    </main>
  );
}