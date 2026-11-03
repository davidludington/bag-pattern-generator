"use client";

import { useState, type ReactNode } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId?: string;
}

export function TextField({ id, label, value, onChange, testId }: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  testId?: string;
  hint?: ReactNode;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled,
  testId,
  hint,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(Number.isFinite(value) ? String(value) : "");
  // Re-sync the text draft when the value changes from outside this input.
  const [syncedValue, setSyncedValue] = useState(value);
  if (!Object.is(syncedValue, value)) {
    setSyncedValue(value);
    setDraft(Number.isFinite(value) ? String(value) : "");
  }

  const resetDraft = () => {
    setDraft(Number.isFinite(value) ? String(value) : "");
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={draft}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          data-testid={testId}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
            const next = Number(raw);
            if (raw.trim() !== "" && Number.isFinite(next)) onChange(next);
          }}
          onBlur={resetDraft}
          className={unit ? "pr-10" : undefined}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-stone-400">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
