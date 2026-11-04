import { expect, test } from "@playwright/test";

const observation = {
  template: "tote",
  confidence: "medium",
  proportions: { width: 4, height: 3.5, depth: 1.2 },
  bottomToTopWidth: null,
  strapDropToHeight: 1.8,
  material: "canvas",
  exteriorPocket: true,
  closure: "open",
  visiblePanels: ["front", "gusset"],
  notes: ["Handles are stitched to the outside of the panels."],
};

test("import a bag from a photo and confirm its measurement", async ({ page }) => {
  // CI never calls the real model: the analysis endpoint is mocked.
  let uploaded = false;
  await page.route("**/api/analyze-photo", async (route) => {
    uploaded = (route.request().postData() ?? "").includes('name="image"');
    await route.fulfill({ json: { observation } });
  });

  await page.goto("/projects/new");
  await page.getByTestId("start-from-photo").click();
  await expect(page.getByTestId("photo-import")).toBeVisible();

  await page.getByTestId("photo-input").setInputFiles({
    name: "bag.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await page.getByTestId("analyze-photo").click();

  await expect(page.getByTestId("detected-template")).toContainText("tote");
  expect(uploaded).toBe(true);
  await expect(page.getByTestId("assumptions")).toContainText("Interior pocket is off");
  await expect(page.getByTestId("assumptions")).toContainText("From the photo: Handles");

  await page.getByTestId("reference-measurement").fill("40");
  await expect(page.getByTestId("piece-front").getByText(/finished 400 × 350 mm/)).toBeVisible();

  await page.getByTestId("create-from-photo").click();
  await expect(page.getByTestId("configure-view")).toBeVisible();
  await expect(page.getByTestId("width-input")).toHaveValue("40");
  await expect(page.getByTestId("depth-input")).toHaveValue("12");
});

test("shows the server's error when analysis fails", async ({ page }) => {
  await page.route("**/api/analyze-photo", (route) =>
    route.fulfill({ status: 503, json: { error: "Photo import is not configured." } }),
  );
  await page.goto("/projects/new/photo");
  await page.getByTestId("photo-input").setInputFiles({
    name: "bag.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await page.getByTestId("analyze-photo").click();
  await expect(page.getByText("Photo import is not configured.")).toBeVisible();
});
