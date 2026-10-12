import { useEffect, useRef, useState } from "react";
import type { PatternModel, PatternPiece, Pt } from "../model/Pattern";
import { arrowPoints, boundsOf, formatMm, pathD } from "../utils/geometry";

type Props = {
  pattern: PatternModel | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

type Cam = { x: number; y: number; w: number; h: number };

const MIN_W = 30; // mm of sheet visible when fully zoomed in
const MAX_W = 8000;

export default function PatternCanvas({ pattern, selectedId, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cam, setCam] = useState<Cam | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean; pieceId: string | null } | null>(null);

  const sheetCam = (): Cam | null =>
    pattern ? { x: 0, y: 0, w: pattern.sheet.width, h: pattern.sheet.height } : null;

  const toViewBox = (clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const point = toViewBox(e.clientX, e.clientY);
      if (!point) return;
      const factor = Math.exp(e.deltaY * 0.0015);
      setCam((c) => {
        const base = c ?? sheetCam();
        if (!base) return c;
        const w = Math.min(MAX_W, Math.max(MIN_W, base.w * factor));
        const k = w / base.w;
        return {
          x: point[0] - (point[0] - base.x) * k,
          y: point[1] - (point[1] - base.y) * k,
          w,
          h: base.h * k,
        };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern]);

  const fit = () => {
    const svg = svgRef.current;
    if (!svg || !pattern) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / pattern.sheet.width, rect.height / pattern.sheet.height);
    const w = rect.width / scale;
    const h = rect.height / scale;
    setCam({
      x: (pattern.sheet.width - w) / 2,
      y: (pattern.sheet.height - h) / 2,
      w,
      h,
    });
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const pieceEl = (e.target as Element).closest?.("[data-piece-id]");
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      moved: false,
      pieceId: pieceEl?.getAttribute("data-piece-id") ?? null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const svg = svgRef.current;
    if (!d || !svg) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 3) d.moved = true;
    if (!d.moved) return;
    const rect = svg.getBoundingClientRect();
    setCam((c) => {
      const base = c ?? sheetCam();
      if (!base) return c;
      const scale = base.w / rect.width;
      return { ...base, x: base.x - dx * scale, y: base.y - dy * scale };
    });
    d.x = e.clientX;
    d.y = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (d && !d.moved) onSelect(d.pieceId);
  };

  const viewBox = cam
    ? `${cam.x} ${cam.y} ${cam.w} ${cam.h}`
    : pattern
      ? `0 0 ${pattern.sheet.width} ${pattern.sheet.height}`
      : "0 0 100 100";

  return (
    <div className="canvas-wrap">
      <svg
        ref={svgRef}
        className="canvas-svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {pattern && (
          <>
            <rect className="sheet" x={0} y={0} width={pattern.sheet.width} height={pattern.sheet.height} />
            {pattern.pieces.map((piece) => (
              <PieceView key={piece.id} piece={piece} selected={piece.id === selectedId} />
            ))}
          </>
        )}
      </svg>
      {!pattern && <div className="canvas-status">Generating pattern…</div>}
      <button className="canvas-fit" onClick={fit} title="Fit sheet to view">
        Fit
      </button>
    </div>
  );
}

function PieceView({ piece, selected }: { piece: PatternPiece; selected: boolean }) {
  const b = boundsOf(piece.cut);
  const grain = piece.grain;
  return (
    <g
      className={selected ? "piece selected" : "piece"}
      data-piece-id={piece.id}
      transform={`translate(${piece.transform.x} ${piece.transform.y})`}
    >
      <path className="cut" d={pathD(piece.cut, true)} />
      {piece.stitch.map((line, i) => (
        <path key={`stitch-${i}`} className="stitch" d={pathD(line)} />
      ))}
      {piece.fold.map((line, i) => (
        <path key={`fold-${i}`} className="fold" d={pathD(line)} />
      ))}
      {piece.notches.map((line, i) => (
        <path key={`notch-${i}`} className="notch" d={pathD(line)} />
      ))}
      {grain && grain.length >= 2 && (
        <>
          <path className="grain" d={pathD(grain)} />
          <polygon className="grain-head" points={arrowPoints(grain[0], grain[grain.length - 1])} />
        </>
      )}
      <text className="piece-name" x={0} y={b.maxY + 7}>
        {piece.name}
      </text>
      <text className="piece-dims" x={0} y={b.maxY + 12.5}>
        finished {formatMm(piece.finished[0])} × {formatMm(piece.finished[1])} mm · cut{" "}
        {formatMm(piece.cutSize[0])} × {formatMm(piece.cutSize[1])} mm
      </text>
      {piece.notes && (
        <text className="piece-notes" x={0} y={b.maxY + 17}>
          {piece.notes}
        </text>
      )}
    </g>
  );
}
