import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";

export function ProjectMissing() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center">
      <h1 className="text-xl font-semibold text-stone-900">Project not found</h1>
      <p className="mt-2 text-sm text-stone-600">
        It may have been deleted, or it was created in another browser.
      </p>
      <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
        Back to projects
      </Link>
    </div>
  );
}

export function ProjectLoading() {
  return <p className="px-6 py-20 text-sm text-stone-500">Loading project…</p>;
}

export function SaveStatus({
  saving,
  error,
  onRetry,
}: {
  saving: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <p role="alert" className="text-xs text-red-700">
        Changes could not be saved: {error}{" "}
        <button type="button" className="underline" onClick={onRetry}>
          Retry
        </button>
      </p>
    );
  }
  return saving ? <p className="text-xs text-stone-500">Saving…</p> : null;
}
