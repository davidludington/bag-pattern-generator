"use client";

import {
  COMMON_SECTION,
  LEATHER_SECTIONS,
  MATERIALS,
  getTemplateDefinition,
  readField,
  withField,
  type BagConfiguration,
  type FieldDefinition,
  type Material,
  type NumberFieldDefinition,
} from "@bag-patterns/pattern-engine";
import { useId } from "react";
import { cmToMm, mmToCm } from "@/lib/units";
import { NumberField, TextField } from "./form-fields";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";

interface ConfigFormProps {
  configuration: BagConfiguration;
  onChange: (next: BagConfiguration) => void;
  errors?: string[];
  compact?: boolean;
}

const MATERIAL_LABEL: Record<Material, string> = {
  leather: "Leather",
  canvas: "Canvas",
  denim: "Denim",
};

export function ConfigForm({
  configuration,
  onChange,
  errors = [],
  compact = false,
}: ConfigFormProps) {
  const baseId = useId();
  const definition = getTemplateDefinition(configuration.template);
  const set = (key: string, value: number | boolean | string) =>
    onChange(withField(configuration, key, value));

  const renderNumber = (field: NumberFieldDefinition) => {
    // Engine values are mm; body dimensions are shown in cm, thicknesses in mm.
    const inCm = field.unit !== "mm";
    const show = (mm: number) => (inCm ? mmToCm(mm) : mm);
    return (
      <NumberField
        key={field.key}
        id={`${baseId}-${field.key}`}
        label={field.label}
        value={show(Number(readField(configuration, field.key) ?? 0))}
        min={show(field.minMm)}
        max={show(field.maxMm)}
        step={show(field.stepMm ?? 1)}
        unit={inCm ? "cm" : "mm"}
        testId={field.testId}
        onChange={(value) => set(field.key, inCm ? cmToMm(value) : value)}
      />
    );
  };

  const renderField = (field: FieldDefinition) => {
    if (field.kind === "number") return renderNumber(field);
    if (field.kind === "choice") {
      return (
        <div key={field.key} className="col-span-2 space-y-1.5">
          <Label htmlFor={`${baseId}-${field.key}`}>{field.label}</Label>
          <Select
            value={String(readField(configuration, field.key))}
            onValueChange={(value) => set(field.key, value)}
          >
            <SelectTrigger id={`${baseId}-${field.key}`} data-testid={field.testId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.hint && <p className="text-xs text-stone-500">{field.hint}</p>}
        </div>
      );
    }
    return (
      <div
        key={field.key}
        className="col-span-2 flex items-center justify-between rounded-md border border-stone-200 px-3 py-2.5"
      >
        <div>
          <p className="text-sm text-stone-800">{field.label}</p>
          {field.hint && <p className="text-xs text-stone-500">{field.hint}</p>}
        </div>
        <Switch
          aria-label={field.label}
          data-testid={`${field.key}-switch`}
          checked={Boolean(readField(configuration, field.key))}
          onCheckedChange={(checked) => set(field.key, checked)}
        />
      </div>
    );
  };

  const sections = [
    ...definition.sections,
    ...(configuration.material === "leather" ? LEATHER_SECTIONS : []),
  ];

  return (
    <div className={compact ? "space-y-5" : "space-y-7"}>
      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <p className="mb-1 font-semibold">Configuration needs attention</p>
          <ul className="list-inside list-disc space-y-0.5">
            {errors.slice(0, 6).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Project</h2>
        <TextField
          id={`${baseId}-name`}
          label="Name"
          value={configuration.name}
          onChange={(value) => set("name", value)}
        />
        <div className="space-y-1.5">
          <Label htmlFor={`${baseId}-material`}>Material</Label>
          <Select value={configuration.material} onValueChange={(value) => set("material", value)}>
            <SelectTrigger id={`${baseId}-material`} data-testid="material-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIALS.map((material) => (
                <SelectItem key={material} value={material}>
                  {MATERIAL_LABEL[material]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {COMMON_SECTION.fields.map((field) =>
          field.kind === "number" ? renderNumber(field) : null,
        )}
      </section>

      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            {section.title}
          </h2>
          <div className="grid grid-cols-2 gap-3">{section.fields.map(renderField)}</div>
        </section>
      ))}

      <p className="text-xs leading-relaxed text-stone-500">
        All measurements are finished dimensions in centimetres (leather thickness in millimetres).
        The engine adds allowances on top and works in millimetres.
      </p>
    </div>
  );
}
