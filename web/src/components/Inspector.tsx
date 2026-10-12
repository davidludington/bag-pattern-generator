import type { BagSpec, SpecField } from "../model/BagSpec";
import type { PatternModel, PatternPiece } from "../model/Pattern";
import { formatMm } from "../utils/geometry";
import NumberField from "./NumberField";

type Props = {
  spec: BagSpec;
  selectedId: string | null;
  pattern: PatternModel | null;
  onField: (field: SpecField, value: number) => void;
  onClearSelection: () => void;
};

function fieldsFor(id: string | null): SpecField[] {
  if (id === null) {
    return ["width", "height", "depth", "seamAllowance", "handleLength", "handleWidth", "placement"];
  }
  if (id.startsWith("handle")) return ["handleLength", "handleWidth", "placement"];
  if (id === "gusset") return ["width", "depth", "seamAllowance"];
  return ["width", "height", "seamAllowance"]; // front, back
}

const LABELS: Record<SpecField, string> = {
  width: "Width",
  height: "Height",
  depth: "Depth",
  seamAllowance: "Seam allowance",
  handleLength: "Length",
  handleWidth: "Width",
  placement: "Placement (inset)",
};

export default function Inspector({ spec, selectedId, pattern, onField, onClearSelection }: Props) {
  const piece: PatternPiece | null =
    pattern?.pieces.find((p) => p.id === selectedId) ?? null;
  const fields = fieldsFor(selectedId);

  return (
    <aside className="panel inspector">
      <h2>{piece ? piece.name : "Bag"}</h2>

      {piece && (
        <section>
          <dl className="piece-facts">
            <div>
              <dt>Material</dt>
              <dd>{piece.material}</dd>
            </div>
            <div>
              <dt>Finished</dt>
              <dd>
                {formatMm(piece.finished[0])} × {formatMm(piece.finished[1])} mm
              </dd>
            </div>
            <div>
              <dt>Cut size</dt>
              <dd>
                {formatMm(piece.cutSize[0])} × {formatMm(piece.cutSize[1])} mm
              </dd>
            </div>
          </dl>
          {piece.notes && <p className="hint">{piece.notes}</p>}
          <button className="link-button" onClick={onClearSelection}>
            ← back to bag properties
          </button>
        </section>
      )}

      <section>
        <h3>{piece ? "Affects" : "Properties"}</h3>
        {fields.map((field) => {
          const value =
            field === "width"
              ? spec.dimensions.width
              : field === "height"
                ? spec.dimensions.height
                : field === "depth"
                  ? spec.dimensions.depth
                  : field === "seamAllowance"
                    ? spec.construction.seamAllowance
                    : field === "handleLength"
                      ? spec.handles.length
                      : field === "handleWidth"
                        ? spec.handles.width
                        : spec.handles.placement;
          return (
            <NumberField
              key={field}
              label={LABELS[field]}
              value={value}
              min={field === "seamAllowance" || field === "placement" ? 0 : 1}
              onCommit={(v) => onField(field, v)}
            />
          );
        })}
      </section>
    </aside>
  );
}
