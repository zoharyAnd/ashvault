import { RevealSecret } from "@/components/reveal-secret";

export const dynamic = "force-dynamic";

export default async function SecretPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RevealSecret id={id} />;
}
