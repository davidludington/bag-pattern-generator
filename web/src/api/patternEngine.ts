import type { BagSpec } from "../model/BagSpec";
import type { PatternModel } from "../model/Pattern";

export class ApiError extends Error {}

async function post<T>(path: string, spec: BagSpec, accept: "json" | "text"): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the status message
    }
    throw new ApiError(message);
  }
  return (accept === "text" ? res.text() : res.json()) as Promise<T>;
}

export function fetchPattern(spec: BagSpec): Promise<PatternModel> {
  return post<PatternModel>("/api/pattern", spec, "json");
}

export function fetchSvg(spec: BagSpec): Promise<string> {
  return post<string>("/api/export.svg", spec, "text");
}
