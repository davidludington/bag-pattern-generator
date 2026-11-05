"use client";

import {
  assemble,
  framePolygon,
  pieceThicknessMm,
  type Pattern,
  type PieceFrame,
  type Sweep,
} from "@bag-patterns/pattern-engine";
import { Canvas } from "@react-three/fiber";
import { Bounds, ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

const COLORS: Record<string, string> = {
  body: "#b08968",
  base: "#8c6a4a",
  gusset: "#9c7855",
  strap: "#5b4636",
  pocket: "#c9a27c",
  filler: "#a8a29e",
  flap: "#a67c52",
};
const SCALE = 0.01; // mm -> scene units

function PieceMesh({
  pattern,
  frame,
  selected,
  onSelect,
}: {
  pattern: Pattern;
  frame: PieceFrame;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const piece = pattern.pieces.find((p) => p.id === frame.pieceId);
  const geometry = useMemo(() => {
    if (!piece) return null;
    const shape = new THREE.Shape(
      framePolygon(piece, frame).map((p) => new THREE.Vector2(p.x, p.y)),
    );
    return new THREE.ExtrudeGeometry(shape, {
      depth: pieceThicknessMm(piece),
      bevelEnabled: false,
    });
  }, [piece, frame]);
  const matrix = useMemo(() => {
    const x = new THREE.Vector3(...frame.xAxis);
    const y = new THREE.Vector3(...frame.yAxis);
    return new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)).setPosition(...frame.origin);
  }, [frame]);
  if (!piece || !geometry) return null;
  return (
    <mesh
      geometry={geometry}
      matrixAutoUpdate={false}
      matrix={matrix}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(piece.id);
      }}
    >
      <meshStandardMaterial
        color={selected ? "#f59e0b" : (COLORS[piece.component] ?? "#a8a29e")}
        side={THREE.DoubleSide}
        roughness={0.8}
      />
    </mesh>
  );
}

function sweepGeometry(sweep: Sweep): THREE.BufferGeometry {
  const points = sweep.path.map((p) => new THREE.Vector3(...p));
  if (sweep.kind === "tube") {
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, sweep.size / 2, 12);
  }
  const dir = new THREE.Vector3(...sweep.dir).multiplyScalar(sweep.size / 2);
  const positions = points.flatMap((p) => [...p.clone().sub(dir), ...p.clone().add(dir)]);
  const index = points
    .slice(1)
    .flatMap((_, i) => [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

function SweepMesh({
  sweep,
  color,
  selected,
  onSelect,
}: {
  sweep: Sweep;
  color: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const geometry = useMemo(() => sweepGeometry(sweep), [sweep]);
  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(sweep.pieceId);
      }}
    >
      <meshStandardMaterial
        color={selected ? "#f59e0b" : color}
        side={THREE.DoubleSide}
        roughness={0.8}
      />
    </mesh>
  );
}

export function BagViewer3D({
  pattern,
  selectedId,
  onSelect,
  className,
}: {
  pattern: Pattern | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}) {
  const assembly = useMemo(() => (pattern ? assemble(pattern) : null), [pattern]);
  return (
    <section
      className={`relative overflow-hidden rounded-lg border border-stone-300 bg-stone-100 ${className ?? ""}`}
      data-testid="bag-viewer-3d"
    >
      {!pattern || !assembly ? (
        <p className="p-6 text-sm text-stone-500">
          3D view is not available for this template yet.
        </p>
      ) : (
        <Canvas camera={{ position: [4, 3, 6], fov: 40 }} onPointerMissed={() => onSelect(null)}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} />
          <Environment preset="studio" />
          <Bounds fit clip observe margin={1.3}>
            <group scale={SCALE}>
              {assembly.frames.map((frame, i) => (
                <PieceMesh
                  key={`${frame.pieceId}-${i}`}
                  pattern={pattern}
                  frame={frame}
                  selected={frame.pieceId === selectedId}
                  onSelect={onSelect}
                />
              ))}
              {assembly.sweeps.map((sweep, i) => (
                <SweepMesh
                  key={`${sweep.pieceId}-${i}`}
                  sweep={sweep}
                  color={COLORS.strap ?? "#5b4636"}
                  selected={sweep.pieceId === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </group>
          </Bounds>
          <ContactShadows position={[0, 0, 0]} opacity={0.4} blur={2} scale={20} />
          <OrbitControls makeDefault target={[0, 0, 0]} />
        </Canvas>
      )}
    </section>
  );
}
