"use client";

import { getTemplateDefinition, type BagConfiguration } from "@bag-patterns/pattern-engine";
import Link from "next/link";
import { usePattern } from "@/lib/use-pattern";
import { useProject } from "@/lib/use-project";
import { cn } from "@/lib/utils";
import { ConfigForm } from "./config-form";
import { PatternCanvas } from "./pattern-canvas";
import { ProjectLoading, ProjectMissing, SaveError } from "./project-status";
import { buttonVariants } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function ConfigureView({ id }: { id: string }) {
  const { state, update, saveError } = useProject(id);
  const project = state.status === "ready" ? state.project : null;
  const { pattern, errors } = usePattern(project?.configuration ?? null);

  if (state.status === "missing") return <ProjectMissing />;
  if (!project) return <ProjectLoading />;

  const template = getTemplateDefinition(project.configuration.template);

  const updateConfiguration = (configuration: BagConfiguration) =>
    update((current) => ({ ...current, name: configuration.name, configuration }));

  return (
    <div className="min-h-screen" data-testid="configure-view">
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <Link
              href="/"
              className="text-xs font-medium uppercase tracking-widest text-stone-500 hover:text-stone-800"
            >
              ← Projects
            </Link>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-stone-900">
              {project.name}
            </h1>
            <p className="text-sm text-stone-600">
              Configure the {template.label.toLowerCase()}, then open the pattern workspace.
            </p>
            <SaveError message={saveError} />
          </div>
          <Link
            href={`/projects/${project.id}/workspace`}
            data-testid="open-workspace"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            Open workspace
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Bag configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfigForm
              configuration={project.configuration}
              onChange={updateConfiguration}
              errors={errors}
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[60vh] flex-col">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Pattern preview</CardTitle>
            <span className="text-xs text-stone-500">
              {pattern
                ? `${pattern.pieces.length} pieces · mm`
                : "waiting for a valid configuration"}
            </span>
          </CardHeader>
          <CardContent className="flex-1">
            <PatternCanvas pattern={pattern} mode="preview" className="h-full min-h-[55vh]" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
