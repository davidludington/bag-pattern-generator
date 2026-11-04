import {
  defaultConfiguration,
  defaultToteConfiguration,
  layoutPieces,
  TEMPLATE_IDS,
  type BagConfiguration,
  type Pattern,
  type TemplateId,
} from "@bag-patterns/pattern-engine";
import { z } from "zod";
import { buildPattern } from "./build-pattern";
import { SHEET_LAYOUT } from "./pattern-draw";

/** A piece's placement on the sheet: translation of its local origin, plus rotation. */
export interface PieceTransform {
  x: number;
  y: number;
  rotation: number;
}

/**
 * A saved project. `configuration` is the user's working draft: it always has
 * the template's full shape, but its values may fail validation while the user
 * is mid-edit. Views validate it before generating a pattern; storage never
 * drops a project because its draft is invalid.
 *
 * `name` is the source of truth; `configuration.name` is kept in sync on save.
 */
export interface Project {
  id: string;
  name: string;
  configuration: BagConfiguration;
  workspace: Record<string, PieceTransform>;
  createdAt: string;
  updatedAt: string;
}

export interface NewProjectInput {
  name: string;
  configuration: BagConfiguration;
}

/**
 * Persistence boundary for projects. The browser implementation uses
 * localStorage; a server-backed (e.g. Prisma/Postgres) store can implement the
 * same interface without changing the views.
 */
export interface ProjectStore {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(input: NewProjectInput): Promise<Project>;
  save(project: Project): Promise<Project>;
  remove(id: string): Promise<void>;
}

export const STORAGE_KEY = "bag-pattern-projects-v2";
/** v1 stored placements as offsets from the automatic layout. */
export const LEGACY_STORAGE_KEY = "bag-pattern-projects-v1";

const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
});

const storedProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().catch(""),
  configuration: z.record(z.string(), z.unknown()),
  workspace: z.record(z.string(), transformSchema).catch({}),
  createdAt: z.string().catch(""),
  updatedAt: z.string().catch(""),
});

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isTemplateId(value: unknown): value is TemplateId {
  return TEMPLATE_IDS.includes(value as TemplateId);
}

/**
 * Rebuild a draft configuration from stored JSON: unknown keys are dropped and
 * missing keys come from the template defaults. Projects saved before
 * multi-template support have no `template` and are totes.
 */
function restoreConfiguration(raw: Record<string, unknown>): BagConfiguration | null {
  const template = raw.template === undefined ? "tote" : raw.template;
  if (!isTemplateId(template)) return null;
  const defaults = defaultConfiguration(template) as Record<string, unknown>;
  const restored: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (key in raw && typeof raw[key] === typeof defaults[key]) restored[key] = raw[key];
  }
  restored.template = template;
  return restored as unknown as BagConfiguration;
}

export function restoreProject(value: unknown): Project | null {
  const parsed = storedProjectSchema.safeParse(value);
  if (!parsed.success) return null;
  const configuration = restoreConfiguration(parsed.data.configuration);
  if (!configuration) return null;
  const name = parsed.data.name || configuration.name || "Untitled project";
  const createdAt = parsed.data.createdAt || nowIso();
  return {
    id: parsed.data.id,
    name,
    configuration: { ...configuration, name },
    workspace: parsed.data.workspace,
    createdAt,
    updatedAt: parsed.data.updatedAt || createdAt,
  };
}

/** Drop placements for pieces the current pattern no longer has. */
export function pruneWorkspace(
  workspace: Record<string, PieceTransform>,
  pieceIds: Iterable<string>,
): Record<string, PieceTransform> {
  const keep = new Set(pieceIds);
  return Object.fromEntries(Object.entries(workspace).filter(([id]) => keep.has(id)));
}

export function emptyTransform(): PieceTransform {
  return { x: 0, y: 0, rotation: 0 };
}

/**
 * Where each piece sits on the sheet: the user's placement if they moved it,
 * otherwise the automatic layout. Placements are absolute, so editing the
 * configuration never moves a piece the user placed.
 */
export function resolveTransforms(
  pattern: Pattern,
  workspace: Record<string, PieceTransform>,
): Record<string, PieceTransform> {
  return Object.fromEntries(
    layoutPieces(pattern.pieces, SHEET_LAYOUT).placements.map(({ piece, x, y }) => [
      piece.id,
      workspace[piece.id] ?? { x, y, rotation: 0 },
    ]),
  );
}

/** Turn a v1 record's layout offsets into absolute placements. */
function migrateLegacyRecord(record: unknown): unknown {
  const project = restoreProject(record);
  if (!project) return record;
  const { pattern } = buildPattern(project.configuration);
  const auto = pattern ? resolveTransforms(pattern, {}) : {};
  const workspace = Object.fromEntries(
    Object.entries(project.workspace).flatMap(([id, offset]) => {
      const base = auto[id];
      return base
        ? [[id, { x: base.x + offset.x, y: base.y + offset.y, rotation: offset.rotation }]]
        : [];
    }),
  );
  return { ...project, workspace };
}

function seedProjects(): Project[] {
  const bag = defaultToteConfiguration();
  const createdAt = nowIso();
  const sample = (name: string, overrides: Partial<BagConfiguration>): Project => ({
    id: createId(),
    name,
    configuration: { ...bag, ...overrides, name } as BagConfiguration,
    workspace: {},
    createdAt,
    updatedAt: createdAt,
  });
  return [
    sample("Market Tote", {
      widthMm: 400,
      heightMm: 350,
      depthMm: 120,
      strapLengthMm: 650,
      interiorPocket: true,
      exteriorPocket: true,
    }),
    sample("Leather Day Tote", {
      widthMm: 320,
      heightMm: 280,
      strapWidthMm: 25,
      strapLengthMm: 580,
      material: "leather",
      exteriorPocket: true,
      seamAllowanceMm: 8,
    }),
  ];
}

/**
 * localStorage-backed store. Writes operate on the raw stored array, so a
 * record this version cannot read is preserved rather than overwritten.
 */
export function createLocalProjectStore(
  storage: () => Storage | null = () =>
    typeof window === "undefined" ? null : window.localStorage,
): ProjectStore {
  const parseRecords = (raw: string | null | undefined): unknown[] => {
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const writeRaw = (records: unknown[]) => {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(records));
  };
  // The v1 key is left in place as a backup.
  const migrateLegacy = () => {
    const store = storage();
    if (!store || store.getItem(STORAGE_KEY) !== null) return;
    const legacy = store.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) writeRaw(parseRecords(legacy).map(migrateLegacyRecord));
  };
  const readRaw = (): unknown[] => {
    migrateLegacy();
    return parseRecords(storage()?.getItem(STORAGE_KEY));
  };
  const idOf = (record: unknown) =>
    record && typeof record === "object" && "id" in record ? record.id : undefined;
  const readAll = () =>
    readRaw()
      .map(restoreProject)
      .filter((project): project is Project => project !== null);

  return {
    async list() {
      migrateLegacy();
      const store = storage();
      if (store && store.getItem(STORAGE_KEY) === null) writeRaw(seedProjects());
      return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async get(id) {
      return readAll().find((project) => project.id === id) ?? null;
    },
    async create({ name, configuration }) {
      const timestamp = nowIso();
      const projectName = name.trim() || "Untitled project";
      const project: Project = {
        id: createId(),
        name: projectName,
        configuration: { ...configuration, name: projectName },
        workspace: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      writeRaw([...readRaw(), project]);
      return project;
    },
    async save(project) {
      const saved: Project = {
        ...project,
        configuration: { ...project.configuration, name: project.name },
        updatedAt: nowIso(),
      };
      const records = readRaw();
      const index = records.findIndex((record) => idOf(record) === project.id);
      if (index === -1) records.push(saved);
      else records[index] = saved;
      writeRaw(records);
      return saved;
    },
    async remove(id) {
      writeRaw(readRaw().filter((record) => idOf(record) !== id));
    },
  };
}

export const projectStore: ProjectStore = createLocalProjectStore();
