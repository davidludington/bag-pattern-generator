import { useRef } from "react";
import { fetchSvg } from "../api/patternEngine";
import type { BagSpec } from "../model/BagSpec";

type Props = {
  spec: BagSpec;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onLoad: (spec: BagSpec) => void;
  onError: (message: string | null) => void;
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isBagSpec(value: unknown): value is BagSpec {
  if (typeof value !== "object" || value === null) return false;
  const bag = value as Record<string, unknown>;
  const dims = bag.dimensions as Record<string, unknown> | undefined;
  const con = bag.construction as Record<string, unknown> | undefined;
  const handles = bag.handles as Record<string, unknown> | undefined;
  return (
    bag.type === "tote" &&
    !!dims &&
    ["width", "height", "depth"].every((k) => typeof dims[k] === "number") &&
    !!con &&
    typeof con.seamAllowance === "number" &&
    !!handles &&
    ["length", "width", "placement"].every((k) => typeof handles[k] === "number")
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printPage(svg: string, title: string): string {
  const body = svg.replace(/^<\?xml[^>]*>\s*/, "");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} pattern</title><style>
    body { margin: 0; font: 13px system-ui, sans-serif; }
    .hint { padding: 8px 12px; background: #fff8dc; border-bottom: 1px solid #e0d090; }
    svg { display: block; }
    @media print { .hint { display: none; } }
  </style></head><body><p class="hint">Print at 100% / Actual size, then check the 100 mm scale bar with a ruler.</p>${body}</body></html>`;
}

export default function Toolbar({
  spec,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onLoad,
  onError,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const title = spec.name ?? spec.type;

  const save = () => {
    const blob = new Blob([JSON.stringify({ version: 1, bag: spec }, null, 2)], {
      type: "application/json",
    });
    download(blob, `${title}.bag.json`);
    onError(null);
  };

  const openFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { version?: number; bag?: unknown };
      if (parsed.version !== 1 || !isBagSpec(parsed.bag)) {
        throw new Error("not a valid .bag.json (expected version 1 with a tote spec)");
      }
      onLoad(parsed.bag);
      onError(null);
    } catch (e) {
      onError(errorMessage(e));
    }
  };

  const exportSvg = async () => {
    try {
      const svg = await fetchSvg(spec);
      download(new Blob([svg], { type: "image/svg+xml" }), `${title}.svg`);
      onError(null);
    } catch (e) {
      onError(errorMessage(e));
    }
  };

  const print = async () => {
    const win = window.open("about:blank", "_blank");
    try {
      const svg = await fetchSvg(spec);
      if (!win) throw new Error("popup blocked — allow popups, or use Export SVG instead");
      win.document.write(printPage(svg, title));
      win.document.close();
      onError(null);
    } catch (e) {
      win?.close();
      onError(errorMessage(e));
    }
  };

  return (
    <header className="toolbar">
      <span className="app-title">Bag Pattern Studio</span>
      <div className="toolbar-actions">
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z / Ctrl+Y)">
          Redo
        </button>
        <span className="toolbar-sep" />
        <button onClick={save}>Save</button>
        <button onClick={() => fileRef.current?.click()}>Open</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void openFile(file);
            e.target.value = "";
          }}
        />
        <span className="toolbar-sep" />
        <button onClick={() => void exportSvg()}>Export SVG</button>
        <button onClick={() => void print()}>Print / PDF</button>
      </div>
    </header>
  );
}
