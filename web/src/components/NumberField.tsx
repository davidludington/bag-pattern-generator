import { useState } from "react";

type Props = {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
};

/** Numeric input that commits valid values live but keeps free typing intact. */
export default function NumberField({ label, value, onCommit, min = 0 }: Props) {
  const [text, setText] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);

  // resync when the value changes from outside (undo/redo, file open)
  if (value !== prevValue) {
    setPrevValue(value);
    setText(String(value));
  }

  const commit = (next: string) => {
    setText(next);
    const parsed = parseFloat(next);
    if (Number.isFinite(parsed) && parsed >= min) onCommit(parsed);
  };

  const revert = () => {
    const parsed = parseFloat(text);
    if (!Number.isFinite(parsed) || parsed < min) setText(String(value));
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          onChange={(e) => commit(e.target.value)}
          onBlur={revert}
        />
        <span className="field-unit">mm</span>
      </span>
    </label>
  );
}
