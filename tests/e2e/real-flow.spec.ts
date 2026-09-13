import { test, expect } from "@playwright/test";
import path from "node:path";
import { analysisRequestSchema } from "../../src/lib/analysis/request-schema";
import { scoreEvidence } from "../../src/lib/analysis/scoring";

const video = path.join(process.cwd(), "tests/fixtures/observation.webm");

test("extracts six genuine JPEG frames and presents categorical real evidence", async ({
  page,
}) => {
  let requests = 0;
  const result = scoreEvidence({
    quality: "GOOD",
    qualityIssues: [],
    waterDetected: true,
    waterEvidence: "STRONG",
    waterSupportingFrames: [0, 5],
    activeFlow: "YES",
    persistentSource: "YES",
    spreading: "YES",
    activeFlowFrames: [0, 2, 5],
    persistentSourceFrames: [0, 3, 5],
    spreadingFrames: [0, 5],
    evidence: [],
  });
  await page.route("**/api/analyze", async (route) => {
    requests++;
    const request = analysisRequestSchema.parse(route.request().postDataJSON());
    expect(request.frames).toHaveLength(6);
    for (const frame of request.frames) {
      const bytes = Buffer.from(frame.image.split(",")[1], "base64");
      expect([...bytes.subarray(0, 3)]).toEqual([255, 216, 255]);
      expect([...bytes.subarray(-2)]).toEqual([255, 217]);
    }
    await route.fulfill({ json: { result } });
  });
  await page.goto("/scan");
  await expect(page.getByLabel("Demo scenario")).toHaveCount(0);
  await page.getByLabel("Choose video file").setInputFiles(video);
  await page
    .getByRole("button", { name: "Analyse video", exact: true })
    .click();
  await expect(page.getByText("Water evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Active flow", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Active flow probability", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Report for inspection", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(1);
  // Persist a real-mode result through the actual browser repository.
  await page
    .getByRole("button", { name: "Report for inspection", exact: true })
    .click();
  await page.getByLabel("Latitude", { exact: true }).fill("43.65");
  await page.getByLabel("Longitude", { exact: true }).fill("51.16");
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(page.getByText("Report created", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View report in dashboard" }).click();
  await expect(page.getByText("Water evidence", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Water evidence", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Report video evidence")).toBeVisible();
});

test("missing server key is a visible error without a silent demo fallback", async ({
  page,
}) => {
  await page.goto("/scan");
  await page.getByLabel("Choose video file").setInputFiles(video);
  await page
    .getByRole("button", { name: "Analyse video", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "not configured",
  );
  await expect(page.getByLabel("Demo scenario")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Report for inspection", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Selected video preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analyse video", exact: true }),
  ).toBeEnabled();
});
