import { notFound } from "next/navigation";
import { PhotoImport } from "@/components/photo-import";
import { photoImportAllowed } from "@/lib/photo-flag";
import { currentEmail } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PhotoImportPage() {
  if (!photoImportAllowed(await currentEmail())) notFound();
  return <PhotoImport />;
}
