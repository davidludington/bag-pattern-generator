"use client";

import { defaultConfiguration, TEMPLATE_LIST, type TemplateId } from "@bag-patterns/pattern-engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { projectStore } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { TextField } from "./form-fields";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function TemplatePicker({ photoImport }: { photoImport: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("My Project");

  const create = async (template: TemplateId) => {
    const project = await projectStore.create({
      name,
      configuration: defaultConfiguration(template),
    });
    router.push(`/projects/${project.id}/configure`);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <Link
            href="/projects"
            className="text-xs font-medium uppercase tracking-widest text-stone-500 hover:text-stone-800"
          >
            ← Projects
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">New project</h1>
          <p className="mt-1 text-sm text-stone-600">
            Choose a template. Its dimensions and options are editable next.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <Card>
          <CardContent className="pt-6">
            <TextField
              id="new-project-name"
              label="Project name"
              value={name}
              onChange={setName}
              testId="project-name-input"
            />
          </CardContent>
        </Card>

        {photoImport && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div>
                <p className="text-sm font-medium text-stone-900">Start from a photo</p>
                <p className="text-sm text-stone-600">
                  Upload a bag photo; Claude picks the template and proportions for you to confirm.
                </p>
              </div>
              <Link
                href="/projects/new/photo"
                data-testid="start-from-photo"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Use a photo
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {TEMPLATE_LIST.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{template.label}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-5">
                <p className="text-sm leading-relaxed text-stone-600">{template.description}</p>
                <Button
                  onClick={() => void create(template.id)}
                  data-testid={`create-${template.id}`}
                >
                  Create project
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Link
          href="/projects"
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
        >
          Cancel
        </Link>
      </main>
    </div>
  );
}
