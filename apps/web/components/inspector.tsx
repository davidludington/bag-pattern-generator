"use client";

import { boundsOf, type PatternPiece } from "@bag-patterns/pattern-engine";
import { emptyTransform, type PieceTransform } from "@/lib/projects";
import { formatMm } from "@/lib/units";
import { NumberField } from "./form-fields";
import { Button } from "./ui/button";

interface InspectorProps {
  piece: PatternPiece | null;
  transform: PieceTransform;
  onTransformChange: (transform: PieceTransform) => void;
  onResetPiece: () => void;
  onResetAll: () => void;
}

export function Inspector({
  piece,
  transform,
  onTransformChange,
  onResetPiece,
  onResetAll,
}: InspectorProps) {
  if (!piece) {
    return (
      <div className="flex h-full flex-col justify-between gap-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            Inspector
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            Select a pattern piece in the workspace to see its dimensions and placement controls.
          </p>
        </div>
        <Button variant="outline" onClick={onResetAll}>
          Reset all placements
        </Button>
      </div>
    );
  }

  const bounds = boundsOf(piece.cutPath);
  // Skive zones, reinforcement, and hardware, grouped by label with counts.
  const hardware = [
    ...piece.markings
      .filter((marking) => marking.kind !== "notch")
      .reduce(
        (counts, marking) => counts.set(marking.label, (counts.get(marking.label) ?? 0) + 1),
        new Map<string, number>(),
      ),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
          Inspector
        </h2>
        <h3 className="mt-2 text-base font-semibold text-stone-900">{piece.name}</h3>
        <p className="text-xs uppercase tracking-wide text-stone-500">
          {piece.material} · quantity {piece.quantity}
        </p>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-stone-500">Finished</dt>
          <dd className="font-medium text-stone-900">
            {formatMm(piece.finishedSize.width)} × {formatMm(piece.finishedSize.height)} mm
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-stone-500">Cut</dt>
          <dd className="font-medium text-stone-900">
            {formatMm(bounds.width)} × {formatMm(bounds.height)} mm
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-stone-500">Seam allowance</dt>
          <dd className="font-medium text-stone-900">
            {formatMm(piece.seamAllowance.amountMm)} mm
          </dd>
        </div>
        {piece.thicknessMm !== null && (
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Leather</dt>
            <dd className="font-medium text-stone-900" data-testid="piece-thickness">
              {formatMm(piece.thicknessMm)} mm · {piece.edgeFinish} edges
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-stone-500">Sewn edges</dt>
          <dd className="font-medium text-stone-900">
            {piece.edges.filter((edge) => edge.kind === "sew").length}
          </dd>
        </div>
      </dl>

      {hardware.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            Leatherwork
          </h3>
          <ul className="space-y-0.5 text-xs text-stone-600" data-testid="piece-leatherwork">
            {hardware.map(([label, count]) => (
              <li key={label}>
                {label}
                {count > 1 ? ` ×${count}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {piece.notes && (
        <p className="rounded-md bg-stone-100 p-3 text-xs leading-relaxed text-stone-600">
          {piece.notes}
        </p>
      )}

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
          Placement
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            id="transform-x"
            label="X"
            value={Math.round(transform.x)}
            step={1}
            unit="mm"
            onChange={(value) => onTransformChange({ ...transform, x: value })}
          />
          <NumberField
            id="transform-y"
            label="Y"
            value={Math.round(transform.y)}
            step={1}
            unit="mm"
            onChange={(value) => onTransformChange({ ...transform, y: value })}
          />
          <NumberField
            id="transform-rotation"
            label="Rotate"
            value={transform.rotation}
            step={15}
            unit="°"
            testId="rotation-input"
            onChange={(value) => onTransformChange({ ...transform, rotation: value })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onTransformChange({
                ...transform,
                rotation: transform.rotation - 90,
              })
            }
          >
            Rotate −90°
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onTransformChange({
                ...transform,
                rotation: transform.rotation + 90,
              })
            }
          >
            Rotate +90°
          </Button>
          <Button size="sm" variant="ghost" onClick={onResetPiece}>
            Reset piece
          </Button>
        </div>
      </section>

      <Button variant="outline" className="w-full" onClick={onResetAll}>
        Reset all placements
      </Button>

      <p className="text-xs leading-relaxed text-stone-500">
        Moving and rotating changes workspace placement only. The sewing geometry stays driven by
        the bag configuration.
      </p>
    </div>
  );
}

export function transformFor(
  transforms: Record<string, PieceTransform>,
  id: string | null,
): PieceTransform {
  if (!id) return emptyTransform();
  return transforms[id] ?? emptyTransform();
}
