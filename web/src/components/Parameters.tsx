import type { BagSpec, SpecField } from "../model/BagSpec";
import NumberField from "./NumberField";

type Props = {
  spec: BagSpec;
  onField: (field: SpecField, value: number) => void;
};

export default function Parameters({ spec, onField }: Props) {
  return (
    <aside className="panel parameters">
      <h2>Parameters</h2>

      <section>
        <h3>Bag</h3>
        <p className="static-row">
          <span className="field-label">Type</span>
          <span className="static-value">Rectangular gusseted tote</span>
        </p>
        <NumberField label="Width" value={spec.dimensions.width} min={1} onCommit={(v) => onField("width", v)} />
        <NumberField label="Height" value={spec.dimensions.height} min={1} onCommit={(v) => onField("height", v)} />
        <NumberField label="Depth" value={spec.dimensions.depth} min={1} onCommit={(v) => onField("depth", v)} />
      </section>

      <section>
        <h3>Construction</h3>
        <NumberField
          label="Seam allowance"
          value={spec.construction.seamAllowance}
          onCommit={(v) => onField("seamAllowance", v)}
        />
      </section>

      <section>
        <h3>Handles</h3>
        <NumberField label="Length" value={spec.handles.length} min={1} onCommit={(v) => onField("handleLength", v)} />
        <NumberField label="Width" value={spec.handles.width} min={1} onCommit={(v) => onField("handleWidth", v)} />
        <NumberField label="Placement (inset)" value={spec.handles.placement} onCommit={(v) => onField("placement", v)} />
      </section>

      <p className="hint">
        All dimensions are finished millimeters. Seam allowance is added by the engine on top.
      </p>
    </aside>
  );
}
