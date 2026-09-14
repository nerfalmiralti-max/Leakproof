import { test, expect, type BrowserContext } from "@playwright/test";
import type { LeakReport } from "../../src/domain/report";
import { realCreateReportSchema } from "../../src/lib/reports/schemas";
import path from "node:path";
import { analysisRequestSchema } from "../../src/lib/analysis/request-schema";
import { scoreEvidence } from "../../src/lib/analysis/scoring";

const video = path.join(process.cwd(), "tests/fixtures/observation.webm");

test("extracts six genuine JPEG frames and presents categorical real evidence", async ({
  page,
  browser,
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
    sourceType: "SUSPICIOUS_SOURCE",
    sourceSupportingFrames: [0, 5],
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
  let sharedReport: LeakReport;
  async function mockSharedStorage(context: BrowserContext) {
    await context.route("**/api/reports/upload", async (route) => {
      const input = realCreateReportSchema.parse(
        route.request().postDataJSON(),
      );
      const id = crypto.randomUUID();
      sharedReport = {
        ...input,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "NEW",
        isDemo: false,
        evidenceId: id,
      };
      await route.fulfill({
        json: {
          ticket: "test-receipt",
          uploadUrl: new URL("/mock-upload", route.request().url()).href,
        },
      });
    });
    await context.route("**/mock-upload", async (route) => {
      expect(route.request().method()).toBe("PUT");
      expect(route.request().headers()["content-type"]).toContain(
        "multipart/form-data",
      );
      await route.fulfill({ json: {} });
    });
    await context.route("**/api/reports", (route) =>
      route.fulfill({ json: { report: sharedReport }, status: 201 }),
    );
    await context.route("**/api/dispatcher/reports**", async (route) => {
      if (
        route.request().headers().authorization !== "Bearer test-dispatcher"
      ) {
        await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
        return;
      }
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/evidence")) {
        await route.fulfill({
          json: {
            url: new URL("/mock-evidence?token=test", url).href,
            expiresIn: 300,
          },
        });
      } else if (url.pathname.endsWith("/status")) {
        sharedReport = {
          ...sharedReport,
          status: route.request().postDataJSON().status,
        };
        await route.fulfill({ json: { report: sharedReport } });
      } else await route.fulfill({ json: { reports: [sharedReport] } });
    });
    await context.route("**/mock-evidence?token=test", (route) =>
      route.fulfill({ path: video, contentType: "video/webm" }),
    );
  }
  await mockSharedStorage(page.context());
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
  // Submit through the real browser adapter with mock remote services (no cloud calls).
  await page
    .getByRole("button", { name: "Report for inspection", exact: true })
    .click();
  await page.getByLabel("Latitude", { exact: true }).fill("43.65");
  await page.getByLabel("Longitude", { exact: true }).fill("51.16");
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(page.getByText("Report created", { exact: true })).toBeVisible();
  const dispatcher = await browser.newPage(); // independent cookies, sessionStorage and IndexedDB
  try {
    await mockSharedStorage(dispatcher.context());
    await dispatcher.goto(new URL("/dashboard", page.url()).href);
    await expect(
      dispatcher.getByText(
        "Unlock the dispatcher workspace to load shared reports.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      dispatcher.locator(".map-shell .leaflet-container"),
    ).toBeVisible();
    await expect(dispatcher.locator(".map-shell .incident-marker")).toHaveCount(
      0,
    );
    await expect(
      dispatcher
        .getByRole("region", { name: "Incident list" })
        .getByRole("listitem"),
    ).toHaveCount(0);
    await expect(
      dispatcher.getByText("CITIZEN REPORT", { exact: true }),
    ).toHaveCount(0);
    await dispatcher
      .getByLabel("Dispatcher access key")
      .fill("test-dispatcher");
    await dispatcher.getByRole("button", { name: "Unlock workspace" }).click();
    await expect(
      dispatcher.getByText("CITIZEN REPORT", { exact: true }),
    ).toBeVisible();
    await expect(dispatcher.locator(".map-shell .incident-marker")).toHaveCount(
      1,
    );
    await expect(
      dispatcher
        .getByRole("region", { name: "Incident list" })
        .getByRole("listitem"),
    ).toHaveCount(1);
    await expect(
      dispatcher.getByText("Water evidence", { exact: true }),
    ).toBeVisible();
    const playback = dispatcher.getByLabel("Report video evidence");
    await expect
      .poll(() =>
        playback.evaluate((node: HTMLVideoElement) => node.readyState),
      )
      .toBeGreaterThanOrEqual(1);
    await dispatcher
      .getByLabel("Update report status")
      .selectOption("IN_REVIEW");
    await dispatcher
      .getByRole("button", { name: "Save status", exact: true })
      .click();
    await expect(
      dispatcher
        .getByRole("region", { name: "Selected report details" })
        .getByRole("status")
        .filter({ hasText: /status saved/i }),
    ).toBeVisible();
    await dispatcher.reload();
    await expect(dispatcher.getByLabel("Update report status")).toHaveValue(
      "IN_REVIEW",
    );
    await dispatcher
      .getByRole("button", { name: "Lock workspace", exact: true })
      .click();
    await expect(
      dispatcher.getByText("CITIZEN REPORT", { exact: true }),
    ).toHaveCount(0);
    await expect(dispatcher.getByLabel("Report video evidence")).toHaveCount(0);
    await expect(dispatcher.locator(".map-shell .incident-marker")).toHaveCount(
      0,
    );
    await expect(
      dispatcher.getByText(
        "Unlock the dispatcher workspace to load shared reports.",
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    await dispatcher.close();
  }
});

test("empty shared workspace has no seeded incidents or map markers", async ({
  page,
}) => {
  await page.route("**/api/dispatcher/reports", (route) =>
    route.fulfill({ json: { reports: [] } }),
  );
  await page.goto("/dashboard");
  await page.getByLabel("Dispatcher access key").fill("test-dispatcher");
  await page.getByRole("button", { name: "Unlock workspace" }).click();
  await expect(
    page.getByText("No shared reports yet", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-shell .leaflet-container")).toBeVisible();
  await expect(page.locator(".map-shell .incident-marker")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Incident list" }).getByRole("listitem"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Selected report details" }),
  ).toHaveCount(0);
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
