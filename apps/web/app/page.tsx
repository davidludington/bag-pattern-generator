import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POINTS = [
  "Pick a bag template: tote, pouch, drawstring, Birkin and more.",
  "Dimensions are finished sizes; seam allowances are added for you.",
  "Export a printable SVG cutting pattern, fabric or leather.",
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
        Bag Pattern Studio
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
        Printable bag patterns from the measurements you want.
      </h1>
      <ul className="list-disc space-y-2 pl-5 text-stone-600">
        {POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/projects/new"
          data-testid="start-project"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          Start a project
        </Link>
        <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }))}>
          My projects
        </Link>
      </div>
      <p className="text-xs text-stone-500">
        Projects are saved in this browser only. Nothing is uploaded unless you use photo import.
      </p>
    </main>
  );
}
