"use client";

import { getTemplateDefinition, type BagConfiguration } from "@bag-patterns/pattern-engine";
import Link from "next/link";
import { useState } from "react";
import { buildPattern } from "@/lib/build-pattern";
import { pruneWorkspace, type PieceTransform } from "@/lib/projects";
import { renderPatternSvg } from "@/lib/svg";
import { usePattern } from "@/lib/use-pattern";
import { useProject } from "@/lib/use-project";
import { cn } from "@/lib/utils";
import { ConfigForm } from "./config-form";
import { Inspector, transformFor } from "./inspector";
import { PatternCanvas } from "./pattern-canvas";
import { ProjectLoading, ProjectMissing, SaveError } from "./project-status";
import { Button, buttonVariants } from "./ui/button";

export function WorkspaceView({ id }: { id: string }) {
  const { state, update, saveError } = useProject(id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const project = state.status === "ready" ? state.project : null;
  const { pattern, errors } = usePattern(project?.configuration ?? null);

  if (state.status === "missing") return <ProjectMissing />;
  if (!project) return <ProjectLoading />;

  const template = getTemplateDefinition(project.configuration.template);

  const updateConfiguration = (configuration: BagConfiguration) =>
    update((current) => {
      // Placements for pieces that no longer exist (e.g. a removed pocket) are dropped.
      const next = buildPattern(configuration).pattern;
      return {
        ...current,
        name: configuration.name,
        configuration,
        workspace: next
          ? pruneWorkspace(
              current.workspace,
              next.pieces.map((piece) => piece.id),
            )
          : current.workspace,
      };
    });

  const updateTransform = (pieceId: string, transform: PieceTransform) =>
    update((current) => ({
      ...current,
      workspace: { ...current.workspace, [pieceId]: transform },
    }));

  const resetPiece = (pieceId: string) =>
    update((current) => {
      const workspace = { ...current.workspace };
      delete workspace[pieceId];
      return { ...current, workspace };
    });

  const resetAll = () => update((current) => ({ ...current, workspace: {} }));

  const exportSvg = () => {
    if (!pattern) return;
    const svg = renderPatternSvg(pattern, project.workspace);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.replace(/[^a-z0-9-_]+/gi, "-") || "pattern"}.svg`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const selectedPiece = pattern?.pieces.find((piece) => piece.id === selectedId) ?? null;
  const selectedTransform = transformFor(project.workspace, selectedId);

  return (
    <div className="flex h-screen flex-col" data-testid="workspace-view">
      <header className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-stone-300 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xs font-medium uppercase tracking-widest text-stone-500 hover:text-stone-800"
          >
            ← Projects
          </Link>
          <div className="h-6 w-px bg-stone-300" />
          <div>
            <h1 className="text-sm font-semibold text-stone-900">{project.name}</h1>
            <p className="text-xs text-stone-500">
              {pattern
                ? `${template.label} · ${pattern.pieces.length} pieces · millimeters`
                : "invalid configuration"}
            </p>
            <SaveError message={saveError} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${project.id}/configure`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Configure
          </Link>
          <Button size="sm" onClick={exportSvg} disabled={!pattern} data-testid="export-svg">
            Export SVG
          </Button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-3 overflow-auto p-3 lg:grid-cols-[300px_minmax(0,1fr)_300px] lg:overflow-hidden">
        <aside className="min-h-0 overflow-y-auto rounded-lg border border-stone-300 bg-white p-4">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-stone-400">
            Configuration
          </h2>
          <ConfigForm
            configuration={project.configuration}
            onChange={updateConfiguration}
            errors={errors}
            compact
          />
        </aside>

        <PatternCanvas
          pattern={pattern}
          mode="edit"
          selectedId={selectedId}
          onSelect={setSelectedId}
          transforms={project.workspace}
          onTransformChange={updateTransform}
          className="min-h-[60vh] lg:min-h-0"
        />

        <aside className="min-h-0 overflow-y-auto rounded-lg border border-stone-300 bg-white p-4">
          <Inspector
            piece={selectedPiece}
            transform={selectedTransform}
            onTransformChange={(transform) => {
              if (selectedId) updateTransform(selectedId, transform);
            }}
            onResetPiece={() => {
              if (selectedId) resetPiece(selectedId);
            }}
            onResetAll={resetAll}
          />
        </aside>
      </main>
    </div>
  );
}
