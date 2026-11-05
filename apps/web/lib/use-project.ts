"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-provider";
import type { Project } from "./projects";

export type ProjectState =
  { status: "loading" } | { status: "missing" } | { status: "ready"; project: Project };

const SAVE_DELAY_MS = 1000;

/**
 * Load one project and update it optimistically. `update` applies a recipe to
 * the latest project (not a stale render closure); saves are debounced and
 * flushed when the page is left. A failed save keeps the draft in memory and
 * `retry` (or the next edit) tries again.
 */
export function useProject(id: string) {
  const { store, ready } = useAuth();
  const [state, setState] = useState<ProjectState>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latest = useRef<Project | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const project = latest.current;
    if (!project || !dirty.current) return;
    dirty.current = false;
    setSaving(true);
    store.save(project).then(
      () => {
        setSaving(false);
        setSaveError(null);
      },
      (error: unknown) => {
        dirty.current = true;
        setSaving(false);
        setSaveError(error instanceof Error ? error.message : "Could not save project");
      },
    );
  }, [store]);

  useEffect(() => {
    if (!ready) return;
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
  }, [id, store, ready]);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const update = useCallback(
    (recipe: (project: Project) => Project) => {
      const current = latest.current;
      if (!current) return;
      const next = recipe(current);
      latest.current = next;
      dirty.current = true;
      setState({ status: "ready", project: next });
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  return { state, update, saving, saveError, retry: flush };
}
