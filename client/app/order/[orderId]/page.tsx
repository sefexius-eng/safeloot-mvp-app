import { ActiveOrderView } from "@/components/order/active-order-view";

interface OrderPageProps {
  params: Promise<{
    orderId: string;
  }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { orderId } = await params;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div>
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
          SafeLoot Deal Room
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.05]">
          Активная сделка по заказу
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400 md:text-base">
          Следите за статусом заказа, переписывайтесь с продавцом и подтвердите получение товара, когда сделка будет завершена.
        </p>
      </div>

      <ActiveOrderView orderId={orderId} />
    </main>
  );
}