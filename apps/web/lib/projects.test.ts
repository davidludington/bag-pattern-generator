import { defaultConfiguration, generatePattern, withField } from "@bag-patterns/pattern-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createLocalProjectStore,
  createSupabaseProjectStore,
  uploadLocalProjects,
  LEGACY_STORAGE_KEY,
  pruneWorkspace,
  resolveTransforms,
  STORAGE_KEY,
  type ProjectStore,
} from "./projects";

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
}

describe("local project store", () => {
  let storage: Storage;
  let projects: ProjectStore;

  beforeEach(() => {
    storage = memoryStorage();
    projects = createLocalProjectStore(() => storage);
  });

  it("seeds samples once and does not reseed after deleting them", async () => {
    const seeded = await projects.list();
    expect(seeded).toHaveLength(2);

    for (const project of seeded) await projects.remove(project.id);
    expect(await projects.list()).toEqual([]);
  });

  it("creates projects from any template and keeps the name in sync", async () => {
    const created = await projects.create({
      name: "Pouch",
      configuration: defaultConfiguration("zip-pouch"),
    });
    expect(created.configuration.template).toBe("zip-pouch");
    expect(created.configuration.name).toBe("Pouch");

    const renamed = await projects.save({ ...created, name: "Renamed" });
    expect(renamed.configuration.name).toBe("Renamed");
    expect((await projects.get(created.id))?.name).toBe("Renamed");
  });

  it("keeps a project whose draft configuration is invalid", async () => {
    const created = await projects.create({
      name: "Draft",
      configuration: defaultConfiguration("tote"),
    });
    await projects.save({
      ...created,
      configuration: withField(created.configuration, "widthMm", 4),
    });
    const other = await projects.create({
      name: "Other",
      configuration: defaultConfiguration("tote"),
    });
    await projects.save(other);

    const reloaded = await projects.get(created.id);
    expect(reloaded?.configuration).toMatchObject({ template: "tote", widthMm: 4 });
  });

  it("preserves stored records it cannot read when saving others", async () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: "future", configuration: { template: "backpack" } }]),
    );
    const created = await projects.create({
      name: "Tote",
      configuration: defaultConfiguration("tote"),
    });
    await projects.save(created);

    const raw = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]") as { id: string }[];
    expect(raw.map((record) => record.id)).toEqual(["future", created.id]);
  });

  it("migrates old tote projects and fills missing fields from defaults", async () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "old-tote",
          name: "Old Tote",
          configuration: { name: "Old Tote", widthMm: 300, unknownField: true },
          workspace: { front: { x: 1, y: 2, rotation: 90 }, bad: "nope" },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );

    const [project] = await projects.list();
    expect(project?.configuration).toEqual({
      ...defaultConfiguration("tote"),
      name: "Old Tote",
      widthMm: 300,
    });
    // a malformed workspace falls back to empty rather than losing the project
    expect(project?.workspace).toEqual({});
  });

  it("converts v1 layout offsets into absolute placements", async () => {
    const configuration = defaultConfiguration("tote");
    storage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify([
        {
          id: "v1",
          name: "Tote",
          configuration,
          workspace: { bottom: { x: 10, y: -20, rotation: 90 } },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );

    const auto = resolveTransforms(generatePattern(configuration), {}).bottom;
    if (!auto) throw new Error("no bottom");
    const [project] = await projects.list();
    expect(project?.id).toBe("v1");
    expect(project?.workspace.bottom).toEqual({ x: auto.x + 10, y: auto.y - 20, rotation: 90 });
    // migrated once: the v1 key is not read again
    expect(await projects.list()).toHaveLength(1);
  });
});

describe("resolveTransforms", () => {
  it("keeps a placed piece where the user put it when the configuration changes", () => {
    const placed = { bottom: { x: 500, y: 600, rotation: 0 } };
    const narrow = generatePattern(defaultConfiguration("tote"));
    const wide = generatePattern({ ...defaultConfiguration("tote"), widthMm: 400 });
    expect(resolveTransforms(narrow, placed).bottom).toEqual(placed.bottom);
    expect(resolveTransforms(wide, placed).bottom).toEqual(placed.bottom);
    // unplaced pieces follow the automatic layout
    expect(resolveTransforms(wide, placed).back).not.toEqual(
      resolveTransforms(narrow, placed).back,
    );
  });
});

describe("pruneWorkspace", () => {
  it("drops placements for pieces that no longer exist", () => {
    const workspace = {
      front: { x: 1, y: 0, rotation: 0 },
      "interior-pocket": { x: 5, y: 5, rotation: 90 },
    };
    expect(pruneWorkspace(workspace, ["front", "back"])).toEqual({
      front: { x: 1, y: 0, rotation: 0 },
    });
  });
});

type Row = Record<string, unknown>;

/** Just enough of the supabase-js query builder for the store. */
function fakeSupabase(rows: Row[], failWith?: string) {
  const result = <T>(data: T) => ({ data, error: failWith ? { message: failWith } : null });
  const from = () => ({
    select: () => ({
      order: async () => result([...rows]),
      eq: (_column: string, id: string) => ({
        maybeSingle: async () => result(rows.find((row) => row.id === id) ?? null),
      }),
    }),
    upsert: async (row: Row) => {
      if (!failWith) {
        const index = rows.findIndex((existing) => existing.id === row.id);
        if (index === -1) rows.push(row);
        else rows[index] = row;
      }
      return result(null);
    },
    delete: () => ({
      eq: async (_column: string, id: string) => {
        if (!failWith) rows.splice(0, rows.length, ...rows.filter((row) => row.id !== id));
        return result(null);
      },
    }),
  });
  return { from } as unknown as SupabaseClient;
}

describe("supabase project store", () => {
  it("round-trips a project, including an invalid draft", async () => {
    const rows: Row[] = [];
    const store = createSupabaseProjectStore(fakeSupabase(rows));
    const created = await store.create({
      name: "Cloud",
      configuration: withField(defaultConfiguration("tote"), "widthMm", 4),
    });

    expect(rows).toHaveLength(1);
    expect(await store.get(created.id)).toMatchObject({
      name: "Cloud",
      configuration: { widthMm: 4 },
    });
    await store.remove(created.id);
    expect(await store.list()).toEqual([]);
  });

  it("skips rows it cannot read and surfaces database errors", async () => {
    const rows: Row[] = [{ id: "future", configuration: { template: "backpack" } }];
    expect(await createSupabaseProjectStore(fakeSupabase(rows)).list()).toEqual([]);

    const failing = createSupabaseProjectStore(fakeSupabase([], "row-level security"));
    await expect(
      failing.create({ name: "x", configuration: defaultConfiguration("tote") }),
    ).rejects.toThrow("row-level security");
  });
});

describe("upload local projects on sign-in", () => {
  it("moves every local project to the cloud and empties the local store", async () => {
    const storage = memoryStorage();
    const local = createLocalProjectStore(() => storage);
    const created = await local.create({
      name: "Mine",
      configuration: defaultConfiguration("tote"),
    });
    const rows: Row[] = [];

    await uploadLocalProjects(local, createSupabaseProjectStore(fakeSupabase(rows)));

    expect(rows.map((row) => row.id)).toContain(created.id);
    expect(await local.list()).toEqual([]);
  });

  it("keeps local projects when the upload fails", async () => {
    const storage = memoryStorage();
    const local = createLocalProjectStore(() => storage);
    const created = await local.create({
      name: "Mine",
      configuration: defaultConfiguration("tote"),
    });

    await expect(
      uploadLocalProjects(local, createSupabaseProjectStore(fakeSupabase([], "offline"))),
    ).rejects.toThrow("offline");
    expect((await local.list()).map((project) => project.id)).toContain(created.id);
  });
});
