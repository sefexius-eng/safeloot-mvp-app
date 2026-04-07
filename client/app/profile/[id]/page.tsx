import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PublicProfileAliasPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PublicProfileAliasPage({ params }: PublicProfileAliasPageProps) {
  const { id } = await params;

  redirect(`/user/${id}`);
}