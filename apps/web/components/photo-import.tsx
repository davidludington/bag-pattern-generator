"use client";

import {
  getTemplateDefinition,
  observationToConfiguration,
  type BagObservation,
  type ReferenceAxis,
} from "@bag-patterns/pattern-engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { projectStore } from "@/lib/projects";
import { cmToMm } from "@/lib/units";
import { usePattern } from "@/lib/use-pattern";
import { NumberField, TextField } from "./form-fields";
import { PatternCanvas } from "./pattern-canvas";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const AXIS_LABEL: Record<ReferenceAxis, string> = {
  width: "Width",
  height: "Height",
  depth: "Depth",
};

type Analysis =
  | { status: "idle" }
  | { status: "analyzing" }
  | { status: "error"; message: string }
  | { status: "done"; observation: BagObservation };

/**
 * Photo -> observation (Claude, server side) -> user confirms one real
 * measurement -> engine builds the configuration. The model never draws the
 * pattern; it only describes the bag.
 */
export function PhotoImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>({ status: "idle" });
  const [name, setName] = useState("Photo import");
  const [axis, setAxis] = useState<ReferenceAxis>("width");
  const [measurementCm, setMeasurementCm] = useState(35);

  // Release each preview URL once it is replaced or the page unmounts.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const reconstruction = useMemo(
    () =>
      analysis.status === "done"
        ? observationToConfiguration(
            analysis.observation,
            { axis, valueMm: cmToMm(measurementCm) },
            name.trim() || "Photo import",
          )
        : null,
    [analysis, axis, measurementCm, name],
  );
  const { pattern } = usePattern(reconstruction?.configuration ?? null);

  const analyze = async () => {
    if (!file) return;
    setAnalysis({ status: "analyzing" });
    const form = new FormData();
    form.append("image", file);
    try {
      const response = await fetch("/api/analyze-photo", { method: "POST", body: form });
      const body = (await response.json()) as { observation?: BagObservation; error?: string };
      if (!response.ok || !body.observation) {
        setAnalysis({ status: "error", message: body.error ?? "Analysis failed." });
        return;
      }
      setAnalysis({ status: "done", observation: body.observation });
    } catch {
      setAnalysis({ status: "error", message: "Could not reach the server." });
    }
  };

  const create = async () => {
    if (!reconstruction) return;
    const project = await projectStore.create({
      name: reconstruction.configuration.name,
      configuration: reconstruction.configuration,
    });
    router.push(`/projects/${project.id}/configure`);
  };

  const observation = analysis.status === "done" ? analysis.observation : null;

  return (
    <div className="min-h-screen" data-testid="photo-import">
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Link
            href="/projects/new"
            className="text-xs font-medium uppercase tracking-widest text-stone-500 hover:text-stone-800"
          >
            ← New project
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
            Start from a photo
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Upload a photo of a bag. Claude identifies the construction and proportions; you confirm
            one real measurement and the pattern engine does the rest.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Photo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                data-testid="photo-input"
                aria-label="Bag photo"
                className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-stone-800 hover:file:bg-stone-100"
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  setFile(next);
                  setPreviewUrl(next ? URL.createObjectURL(next) : null);
                  setAnalysis({ status: "idle" });
                }}
              />
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img
                  src={previewUrl}
                  alt="Selected bag"
                  className="max-h-64 w-full rounded-md border border-stone-200 object-contain"
                />
              )}
              <Button
                className="w-full"
                disabled={!file || analysis.status === "analyzing"}
                onClick={() => void analyze()}
                data-testid="analyze-photo"
              >
                {analysis.status === "analyzing" ? "Analysing…" : "Analyse photo"}
              </Button>
              {analysis.status === "error" && (
                <p role="alert" className="text-sm text-red-700">
                  {analysis.message}
                </p>
              )}
            </CardContent>
          </Card>

          {observation && reconstruction && (
            <Card>
              <CardHeader>
                <CardTitle>2. Confirm</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-stone-700" data-testid="detected-template">
                  Looks like a{" "}
                  <strong>{getTemplateDefinition(observation.template).label.toLowerCase()}</strong>{" "}
                  ({observation.confidence} confidence).
                </p>
                <TextField
                  id="photo-project-name"
                  label="Project name"
                  value={name}
                  onChange={setName}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reference-axis">I measured the</Label>
                    <Select value={axis} onValueChange={(value) => setAxis(value as ReferenceAxis)}>
                      <SelectTrigger id="reference-axis">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(AXIS_LABEL) as ReferenceAxis[]).map((key) => (
                          <SelectItem key={key} value={key}>
                            {AXIS_LABEL[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <NumberField
                    id="reference-measurement"
                    label="Measurement"
                    value={measurementCm}
                    min={1}
                    step={0.5}
                    unit="cm"
                    testId="reference-measurement"
                    onChange={setMeasurementCm}
                  />
                </div>
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-stone-400">
                    Assumptions to check
                  </h3>
                  <ul
                    className="list-inside list-disc space-y-1 text-xs text-stone-600"
                    data-testid="assumptions"
                  >
                    {reconstruction.assumptions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                    {observation.notes.map((note) => (
                      <li key={`note-${note}`}>From the photo: {note}</li>
                    ))}
                  </ul>
                </div>
                <Button
                  className="w-full"
                  onClick={() => void create()}
                  data-testid="create-from-photo"
                >
                  Create project
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="flex min-h-[60vh] flex-col">
          <CardHeader>
            <CardTitle>Pattern preview</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <PatternCanvas pattern={pattern} mode="preview" className="h-full min-h-[55vh]" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
