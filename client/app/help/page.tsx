import type { Metadata } from "next";

const HELP_ITEMS = [
  {
    title: 'Как работает безопасная сделка (Escrow)?',
    body:
      'Ваши деньги не идут напрямую продавцу. После оплаты они замораживаются на специальном транзитном счету маркетплейса. Продавец получает деньги только после того, как вы проверите товар и нажмете кнопку "Подтвердить выполнение".',
  },
  {
    title: 'Что делать, если продавец оказался мошенником?',
    body:
      'Ни в коем случае не нажимайте кнопку подтверждения заказа. Нажмите кнопку "Открыть спор" или напишите в поддержку. Администрация подключится к вашей сделке, проверит переписку и вернет деньги на ваш баланс.',
  },
  {
    title: 'Какая комиссия на вывод средств?',
    body:
      'Комиссия платформы за обработку вывода составляет 5%. Вывод средств доступен только с баланса "Доступно к выводу".',
  },
];

export const metadata: Metadata = {
  title: 'Помощь и правила | SafeLoot',
  description:
    'FAQ и правила SafeLoot: escrow-сделки, споры, поддержка и вывод средств.',
};

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.12),transparent_30%),linear-gradient(180deg,#09090b_0%,#0f1115_100%)] text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
          <span className="inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">
            SafeLoot Help Center
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            FAQ и правила безопасной торговли
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
            Коротко и по делу: как работает Escrow, что делать в спорных ситуациях и на каких условиях выводятся деньги.
          </p>

          <div className="mt-8 rounded-[1.5rem] border border-sky-400/15 bg-sky-500/10 p-5 text-sm leading-7 text-sky-50">
            Деньги по защищенной сделке удерживаются внутри платформы до завершения заказа. Это базовый контур безопасности для покупателя и продавца.
          </div>
        </section>

        <section className="mt-8 space-y-4">
          {HELP_ITEMS.map((item, index) => (
            <details
              key={item.title}
              open={index === 0}
              className="group rounded-[1.75rem] border border-white/10 bg-[#11151b]/95 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.24)] transition open:border-orange-400/20 open:bg-[#141921]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-semibold tracking-tight text-white marker:content-none">
                <span>{item.title}</span>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition group-open:rotate-45 group-open:border-orange-400/20 group-open:text-orange-200">
                  +
                </span>
              </summary>
              <p className="mt-4 pr-2 text-sm leading-7 text-zinc-300 sm:text-[15px]">
                {item.body}
              </p>
            </details>
          ))}
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-300 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
          <h2 className="text-xl font-semibold text-white">
            Когда обращаться в поддержку
          </h2>
          <p className="mt-3">
            Если продавец затягивает передачу товара, просит перевести оплату вне платформы, угрожает, отправляет не тот товар или требует нажать подтверждение раньше проверки, сразу открывайте спор и сохраняйте переписку внутри сделки.
          </p>
        </section>
      </div>
    </div>
  );
}