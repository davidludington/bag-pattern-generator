import { TemplatePicker } from "@/components/template-picker";
import { photoImportAllowed } from "@/lib/photo-flag";
import { currentEmail } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  return <TemplatePicker photoImport={photoImportAllowed(await currentEmail())} />;
}
