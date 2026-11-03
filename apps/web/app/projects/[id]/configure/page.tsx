import { ConfigureView } from "@/components/configure-view";

export default async function ConfigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConfigureView id={id} />;
}
