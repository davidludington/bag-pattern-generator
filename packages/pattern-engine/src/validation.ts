import { polygonArea } from "./geometry";
import type { Edge, Pattern, ValidationIssue } from "./types";

const LENGTH_TOLERANCE_MM = 0.01;

export function validatePattern(pattern: Pattern): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pieceIds = new Set<string>();

  for (const piece of pattern.pieces) {
    if (pieceIds.has(piece.id)) {
      issues.push({ pieceId: piece.id, message: `duplicate piece id "${piece.id}"` });
    }
    pieceIds.add(piece.id);

    if (piece.cutPath.length < 3 || polygonArea(piece.cutPath) <= 0) {
      issues.push({ pieceId: piece.id, message: "cut path is not a valid polygon" });
    }
    for (const line of [...piece.stitchPaths, ...piece.foldPaths]) {
      if (line.points.length < 2) {
        issues.push({ pieceId: piece.id, message: "pattern line has fewer than 2 points" });
      }
    }
    if (piece.quantity < 1) {
      issues.push({ pieceId: piece.id, message: "quantity must be at least 1" });
    }
  }

  const seams = new Map<string, { pieceId: string; edge: Edge }[]>();
  for (const piece of pattern.pieces) {
    for (const edge of piece.edges) {
      if (!edge.seamId) continue;
      const group = seams.get(edge.seamId) ?? [];
      group.push({ pieceId: piece.id, edge });
      seams.set(edge.seamId, group);
    }
  }

  for (const [seamId, group] of seams) {
    if (group.length !== 2) {
      issues.push({
        seamId,
        message: `seam "${seamId}" must join exactly 2 edges, found ${group.length}`,
      });
      continue;
    }
    const [a, b] = group;
    if (!a || !b) continue;
    if (Math.abs(a.edge.length - b.edge.length) > LENGTH_TOLERANCE_MM) {
      issues.push({
        seamId,
        message: `seam "${seamId}" joins edges of ${a.edge.length.toFixed(2)} mm and ${b.edge.length.toFixed(2)} mm`,
      });
    }
  }

  return issues;
}

export function assertValidPattern(pattern: Pattern): void {
  const issues = validatePattern(pattern);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }
}
