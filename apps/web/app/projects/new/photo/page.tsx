import { notFound } from "next/navigation";
import { PhotoImport } from "@/components/photo-import";
import { photoImportEnabled } from "@/lib/photo-flag";

export const dynamic = "force-dynamic";

export default function PhotoImportPage() {
  if (!photoImportEnabled()) notFound();
  return <PhotoImport />;
}
