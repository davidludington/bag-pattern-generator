"use client";

import {
  boundsOf,
  layoutPieces,
  type Pattern,
  type PatternPiece,
} from "@bag-patterns/pattern-engine";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  arrowHead,
  notchPath,
  pathD,
  pieceDimensions,
  pieceTitle,
  punchCross,
  SHEET_LAYOUT,
  splitMarkings,
} from "@/lib/pattern-draw";
import { emptyTransform, resolveTransforms, type PieceTransform } from "@/lib/projects";
import { cn } from "@/lib/utils";

type Camera = { x: number; y: number; w: number; h: number };

interface PatternCanvasProps {
  pattern: Pattern | null;
  mode?: "edit" | "preview";
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  transforms?: Record<string, PieceTransform>;
  /** Called once per drag, on release, with the piece's final placement. */
  onTransformChange?: (id: string, transform: PieceTransform) => void;
  className?: string;
}

const MIN_WIDTH_MM = 30;
const MAX_WIDTH_MM = 8000;

export function PatternCanvas({
  pattern,
  mode = "edit",
  selectedId = null,
  onSelect,
  transforms = {},
  onTransformChange,
  className,
}: PatternCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  // null = auto-fit the whole sheet; set once the user zooms, pans, or fits.
  const [camera, setCamera] = useState<Camera | null>(null);
  // In-progress drag offset, committed through onTransformChange on release.
  const [dragOffset, setDragOffset] = useState<{
    pieceId: string;
    dx: number;
    dy: number;
  } | null>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
    pieceId: string | null;
    mode: "pan" | "piece";
  } | null>(null);

  const layout = useMemo(
    () => (pattern ? layoutPieces(pattern.pieces, SHEET_LAYOUT) : null),
    [pattern],
  );
  const placed = pattern ? resolveTransforms(pattern, transforms) : {};
  const editable = mode === "edit";

  // Keep the user's zoom and pan while they edit dimensions; start fresh when
  // the template changes.
  const template = pattern?.template ?? null;
  const [cameraTemplate, setCameraTemplate] = useState(template);
  if (cameraTemplate !== template) {
    setCameraTemplate(template);
    setCamera(null);
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !layout) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const factor = Math.exp(event.deltaY * 0.0015);
      setCamera((current) => {
        const base = current ?? { x: 0, y: 0, w: layout.width, h: layout.height };
        const width = Math.min(MAX_WIDTH_MM, Math.max(MIN_WIDTH_MM, base.w * factor));
        const scale = width / base.w;
        return {
          x: point.x - (point.x - base.x) * scale,
          y: point.y - (point.y - base.y) * scale,
          w: width,
          h: base.h * scale,
        };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [layout]);

  const fit = () => {
    const svg = svgRef.current;
    if (!svg || !layout) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const scale = Math.min(rect.width / layout.width, rect.height / layout.height);
    const w = rect.width / scale;
    const h = rect.height / scale;
    setCamera({ x: (layout.width - w) / 2, y: (layout.height - h) / 2, w, h });
  };

  const zoomBy = (factor: number) => {
    setCamera((current) => {
      if (!current || !layout) return current;
      const width = Math.min(MAX_WIDTH_MM, Math.max(MIN_WIDTH_MM, current.w * factor));
      const scale = width / current.w;
      return {
        x: current.x + (current.w - width) / 2,
        y: current.y + (current.h - current.h * scale) / 2,
        w: width,
        h: current.h * scale,
      };
    });
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const target = (event.target as Element).closest?.("[data-piece-id]");
    const pieceId = target?.getAttribute("data-piece-id") ?? null;
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      pieceId,
      mode: editable && pieceId && onTransformChange ? "piece" : "pan",
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    const svg = svgRef.current;
    if (!current || !svg) return;

    if (
      !current.moved &&
      Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 3
    ) {
      current.moved = true;
    }
    if (!current.moved) return;

    const rect = svg.getBoundingClientRect();
    const activeCamera =
      camera ?? (layout ? { x: 0, y: 0, w: layout.width, h: layout.height } : null);
    if (!activeCamera) return;
    const scale = Math.min(rect.width / activeCamera.w, rect.height / activeCamera.h);
    if (scale <= 0) return;

    const dx = (event.clientX - current.lastX) / scale;
    const dy = (event.clientY - current.lastY) / scale;

    if (current.mode === "pan") {
      // the first pan leaves auto-fit, starting from the view the user sees
      setCamera((value) => {
        const base = value ?? activeCamera;
        return { ...base, x: base.x - dx, y: base.y - dy };
      });
    } else if (current.pieceId) {
      const pieceId = current.pieceId;
      setDragOffset((offset) =>
        offset && offset.pieceId === pieceId
          ? { pieceId, dx: offset.dx + dx, dy: offset.dy + dy }
          : { pieceId, dx, dy },
      );
    }

    current.lastX = event.clientX;
    current.lastY = event.clientY;
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (current && !current.moved && editable) {
      onSelect?.(current.pieceId);
    }
    if (dragOffset && onTransformChange) {
      const existing = placed[dragOffset.pieceId] ?? emptyTransform();
      onTransformChange(dragOffset.pieceId, {
        ...existing,
        x: existing.x + dragOffset.dx,
        y: existing.y + dragOffset.dy,
      });
    }
    setDragOffset(null);
  };

  const transformOf = (pieceId: string): PieceTransform => {
    const base = placed[pieceId] ?? emptyTransform();
    if (dragOffset?.pieceId !== pieceId) return base;
    return { ...base, x: base.x + dragOffset.dx, y: base.y + dragOffset.dy };
  };

  const viewBox = camera
    ? `${camera.x} ${camera.y} ${camera.w} ${camera.h}`
    : layout
      ? `0 0 ${layout.width} ${layout.height}`
      : "0 0 100 100";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-stone-300 bg-stone-200",
        className,
      )}
    >
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="pattern-canvas"
      >
        {layout && (
          <>
            <rect
              x={0}
              y={0}
              width={layout.width}
              height={layout.height}
              fill="#ffffff"
              stroke="#b9c0c7"
              strokeWidth={0.5}
            />
            {layout.placements.map((placement) => (
              <PieceView
                key={placement.piece.id}
                piece={placement.piece}
                transform={transformOf(placement.piece.id)}
                selected={placement.piece.id === selectedId}
              />
            ))}
          </>
        )}
      </svg>

      {!pattern && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-stone-500">
          Fix the configuration to generate a pattern.
        </div>
      )}

      <div className="absolute right-3 top-3 flex gap-1">
        <button
          type="button"
          onClick={() => zoomBy(1.25)}
          className="h-8 w-8 rounded-md border border-stone-300 bg-white text-sm shadow-sm hover:bg-stone-100"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.8)}
          className="h-8 w-8 rounded-md border border-stone-300 bg-white text-sm shadow-sm hover:bg-stone-100"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={fit}
          className="h-8 rounded-md border border-stone-300 bg-white px-2.5 text-xs shadow-sm hover:bg-stone-100"
          data-testid="fit-view"
        >
          Fit
        </button>
      </div>
    </div>
  );
}

interface PieceViewProps {
  piece: PatternPiece;
  transform: PieceTransform;
  selected: boolean;
}

function PieceView({ piece, transform, selected }: PieceViewProps) {
  const bounds = boundsOf(piece.cutPath);
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;
  const { notches, zones, punches } = splitMarkings(piece.markings);

  return (
    <g
      data-piece-id={piece.id}
      data-selected={selected ? "true" : "false"}
      data-testid={`piece-${piece.id}`}
      transform={`translate(${transform.x} ${transform.y}) rotate(${transform.rotation} ${centerX} ${centerY})`}
      className="cursor-pointer"
    >
      <path className="pattern-cut" d={pathD(piece.cutPath, true)} />
      {zones.map((zone, index) => (
        <path
          key={`zone-${index}`}
          className={zone.zone === "skive" ? "pattern-skive" : "pattern-reinforce"}
          d={pathD(zone.points, true)}
        >
          <title>{zone.label}</title>
        </path>
      ))}
      {piece.stitchPaths.map((line, index) => (
        <path key={`stitch-${index}`} className="pattern-sew" d={pathD(line.points, line.closed)} />
      ))}
      {piece.foldPaths.map((line, index) => (
        <path key={`fold-${index}`} className="pattern-fold" d={pathD(line.points, line.closed)} />
      ))}
      {notches.map((marking, index) => (
        <path key={`notch-${index}`} className="pattern-notch" d={notchPath(marking)} />
      ))}
      {punches.map((marking, index) => (
        <g key={`punch-${index}`} className="pattern-punch">
          <title>{marking.label}</title>
          <circle cx={marking.at.x} cy={marking.at.y} r={marking.diameterMm / 2} />
          <path d={punchCross(marking)} />
        </g>
      ))}
      {piece.grainline && (
        <>
          <path className="pattern-grain" d={pathD([piece.grainline.start, piece.grainline.end])} />
          <polygon
            className="pattern-grain-head"
            points={arrowHead(piece.grainline.start, piece.grainline.end)}
          />
        </>
      )}

      <text className="pattern-label" x={bounds.minX} y={bounds.maxY + 7}>
        {pieceTitle(piece)}
      </text>
      <text className="pattern-label-dims" x={bounds.minX} y={bounds.maxY + 12.5}>
        {pieceDimensions(piece)}
      </text>
    </g>
  );
}
