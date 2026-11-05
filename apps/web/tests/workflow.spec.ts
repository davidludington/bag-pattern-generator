import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("create, configure, edit, and export a tote pattern", async ({ page }) => {
  await page.goto("/projects");

  await page.getByTestId("new-project").click();
  await page.getByTestId("project-name-input").fill("E2E Tote");
  await page.getByTestId("create-tote").click();

  await expect(page.getByTestId("configure-view")).toBeVisible();
  const width = page.getByTestId("width-input");
  await expect(width).toHaveValue("30");

  await width.fill("40");
  await expect(page.getByTestId("piece-front")).toBeVisible();
  await expect(page.getByTestId("piece-front").getByText(/finished 400 × 250 mm/)).toBeVisible();

  await page.getByTestId("open-workspace").click();
  await expect(page.getByTestId("workspace-view")).toBeVisible();

  await page.getByTestId("width-input").fill("42");
  await expect(page.getByTestId("piece-front").getByText(/finished 420 × 250 mm/)).toBeVisible();

  const bottom = page.getByTestId("piece-bottom");
  await bottom.locator("path.pattern-cut").click();
  await expect(page.getByRole("heading", { name: "Bottom" })).toBeVisible();

  const cut = bottom.locator("path.pattern-cut");
  const box = await cut.boundingBox();
  if (!box) throw new Error("bottom piece has no bounding box");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 48, startY + 24, { steps: 6 });
  await page.mouse.up();

  const xValue = await page.locator("#transform-x").inputValue();
  expect(Number(xValue)).not.toBe(0);

  await page.getByRole("button", { name: "Rotate +90°" }).click();
  await expect(page.locator("#transform-rotation")).toHaveValue("90");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-svg").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("download has no path");
  const svg = await readFile(path, "utf8");

  expect(svg).toContain("<svg");
  expect(svg).toContain('width="');
  expect(svg).toContain('mm"');
  expect(svg).toContain('data-piece="front"');
  expect(svg).toContain("100 mm");
});

test("create and export a drawstring pattern", async ({ page }) => {
  await page.goto("/projects");

  await page.getByTestId("new-project").click();
  await page.getByTestId("project-name-input").fill("E2E Drawstring");
  await page.getByTestId("create-drawstring").click();

  await expect(page.getByTestId("configure-view")).toBeVisible();
  await expect(page.getByTestId("casing-input")).toHaveValue("2.5");
  await expect(page.getByTestId("piece-front").getByText(/finished 200 × 250 mm/)).toBeVisible();

  await page.getByTestId("open-workspace").click();
  await expect(page.getByTestId("workspace-view")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-svg").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("download has no path");
  const svg = await readFile(path, "utf8");

  expect(svg).toContain('data-piece="front"');
  expect(svg).toContain('class="fold"');
});

test("keeps a project with an invalid draft across reloads", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByTestId("project-name-input").fill("Draft Tote");
  await page.getByTestId("create-tote").click();
  await expect(page.getByTestId("configure-view")).toBeVisible();

  // 4 cm is below the 10 cm minimum width
  await page.getByTestId("width-input").fill("4");
  await expect(page.getByText("Configuration needs attention")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("configure-view")).toBeVisible();
  await expect(page.getByTestId("width-input")).toHaveValue("4");
  await expect(page.getByText("Configuration needs attention")).toBeVisible();

  await page.getByTestId("width-input").fill("30");
  await expect(page.getByTestId("piece-front")).toBeVisible();
});

test("switch a tote to leather and fold its edges", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByTestId("project-name-input").fill("Leather Tote");
  await page.getByTestId("create-tote").click();
  await expect(page.getByTestId("configure-view")).toBeVisible();

  // canvas: 300 x 250 finished, 10 mm allowance on every edge
  const front = page.getByTestId("piece-front");
  await expect(front.getByText(/cut 320 × 270 mm$/)).toBeVisible();
  await expect(page.getByTestId("leather-body-input")).toHaveCount(0);

  await page.getByTestId("material-select").click();
  await page.getByRole("option", { name: "Leather" }).click();

  // painted opening is cut on the finished line; thickness appears per piece
  await expect(front.getByText(/cut 320 × 260 mm · 1\.1 mm leather/)).toBeVisible();
  await expect(page.getByTestId("leather-body-input")).toHaveValue("1.1");
  await expect(front.locator("path.pattern-skive")).toHaveCount(3);

  await page.getByTestId("edge-finish-select").click();
  await page.getByRole("option", { name: "Folded (turned)" }).click();
  await expect(front.getByText(/cut 320 × 270 mm · 1\.1 mm leather/)).toBeVisible();

  await page.getByTestId("leather-body-input").fill("1.4");
  await expect(front.getByText(/1\.4 mm leather/)).toBeVisible();
});

test("shows the tote in 3D", async ({ page }) => {
  await page.goto("/projects");
  await page.getByTestId("new-project").click();
  await page.getByTestId("project-name-input").fill("E2E 3D");
  await page.getByTestId("create-tote").click();
  await page.getByTestId("open-workspace").click();

  await page.getByTestId("toggle-view").click();
  await expect(page.getByTestId("bag-viewer-3d").locator("canvas")).toBeVisible();
  await page.getByTestId("toggle-view").click();
  await expect(page.getByTestId("pattern-canvas")).toBeVisible();
});
