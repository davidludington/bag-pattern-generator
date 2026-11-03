import { defaultConfiguration, withField } from "@bag-patterns/pattern-engine";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createLocalProjectStore,
  pruneWorkspace,
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
