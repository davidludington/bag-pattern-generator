import { TemplatePicker } from "@/components/template-picker";
import { photoImportEnabled } from "@/lib/photo-flag";

export const dynamic = "force-dynamic"; // env flag is read per request, not baked at build

export default function NewProjectPage() {
  return <TemplatePicker photoImport={photoImportEnabled()} />;
}
