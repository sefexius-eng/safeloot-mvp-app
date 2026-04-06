import { redirect } from "next/navigation";

interface OrdersAliasPageProps {
  params: Promise<{
    orderId: string;
  }>;
}

export default async function OrdersAliasPage({ params }: OrdersAliasPageProps) {
  const { orderId } = await params;

  redirect(`/order/${orderId}`);
}