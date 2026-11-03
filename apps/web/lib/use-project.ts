"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { projectStore, type Project, type ProjectStore } from "./projects";

export type ProjectState =
  { status: "loading" } | { status: "missing" } | { status: "ready"; project: Project };

/**
 * Load one project and update it optimistically. `update` applies a recipe to
 * the latest project (not a stale render closure) and persists the result.
 */
export function useProject(id: string, store: ProjectStore = projectStore) {
  const [state, setState] = useState<ProjectState>({ status: "loading" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const latest = useRef<Project | null>(null);

  useEffect(() => {
    let active = true;
    store.get(id).then(
      (project) => {
        if (!active) return;
        latest.current = project;
        setState(project ? { status: "ready", project } : { status: "missing" });
      },
      () => active && setState({ status: "missing" }),
    );
    return () => {
      active = false;
    };
  }, [id, store]);

  const update = useCallback(
    (recipe: (project: Project) => Project) => {
      const current = latest.current;
      if (!current) return;
      const next = recipe(current);
      latest.current = next;
      setState({ status: "ready", project: next });
      store.save(next).then(
        () => setSaveError(null),
        (error: unknown) =>
          setSaveError(error instanceof Error ? error.message : "Could not save project"),
      );
    },
    [store],
  );

  return { state, update, saveError };
}
