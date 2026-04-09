import { redirect } from "next/navigation";

import { EditProductForm } from "@/components/product/edit-product-form";
import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import {
  getProductById,
  listCatalogGamesForProductForms,
} from "@/lib/domain/products";

interface EditProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const currentUser = await getCurrentSessionUser(await getAuthSession());

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.isBanned) {
    redirect("/");
  }

  const { id } = await params;
  const [product, games] = await Promise.all([
    getProductById(id, {
      viewerId: currentUser.id,
      viewerRole: currentUser.role,
    }),
    listCatalogGamesForProductForms(),
  ]);

  if (!product) {
    redirect("/");
  }

  if (product.seller.id !== currentUser.id && currentUser.role !== "ADMIN") {
    redirect("/profile");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <EditProductForm
        product={{
          id: product.id,
          title: product.title,
          description: product.description,
          images: product.images,
          price: product.price,
          gameId: product.game.id,
          categoryId: product.category.id,
        }}
        games={games}
      />
    </main>
  );
}