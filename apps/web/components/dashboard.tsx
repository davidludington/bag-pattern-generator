"use client";

import { getTemplateDefinition } from "@bag-patterns/pattern-engine";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { type Project } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { AuthButton } from "./auth-button";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function Dashboard() {
  const { store, ready } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void store.list().then((list) => active && setProjects(list));
    return () => {
      active = false;
    };
  }, [store, ready]);

  const remove = async (id: string) => {
    await store.remove(id);
    setProjects(await store.list());
  };

  return (
    <div className="min-h-screen" data-testid="dashboard">
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-6 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
              Bag Pattern Studio
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">Projects</h1>
            <p className="mt-1 text-sm text-stone-600">
              Parametric bag patterns for sewing and leatherwork.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AuthButton />
            <Link
              href="/projects/new"
              data-testid="new-project"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              New project
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {projects === null ? (
          <p className="text-sm text-stone-500">Loading projects…</p>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-10">
              <p className="text-sm text-stone-600">No projects yet. Start with a template.</p>
              <Link href="/projects/new" className={cn(buttonVariants({ variant: "outline" }))}>
                Create a project
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} data-testid="project-card">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{project.name}</CardTitle>
                    <span className="rounded-full border border-stone-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                      {project.configuration.material}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Template</dt>
                      <dd className="font-medium text-stone-900">
                        {getTemplateDefinition(project.configuration.template).label}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Updated</dt>
                      <dd className="text-stone-700">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/projects/${project.id}/workspace`}
                      data-testid={`open-project-${project.id}`}
                      className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                    >
                      Open workspace
                    </Link>
                    <Link
                      href={`/projects/${project.id}/configure`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Configure
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-700 hover:bg-red-50"
                      onClick={() => void remove(project.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
