import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const VIDEO = path.join(process.cwd(), "tests/fixtures/observation.webm");

async function chooseVideo(page: Page, scenario = "HIGH") {
  await page.goto("/scan");
  await page.getByLabel("Choose video file").setInputFiles(VIDEO);
  await expect(page.getByLabel("Selected video preview")).toBeVisible();
  await page.getByLabel("Demo scenario").selectOption(scenario);
}
async function runAnalysis(page: Page) {
  await page.getByRole("button", { name: "Run demo analysis" }).click();
  await expect(
    page.getByRole("heading", { name: "Here’s the assessment." }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("landing renders an actual map and links into the scan", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every drop counts/ }),
  ).toBeVisible();
  await expect(page.locator(".landing-map .leaflet-container")).toBeVisible();
  expect(
    (await page.locator(".landing-map .leaflet-container").boundingBox())!
      .height,
  ).toBeGreaterThan(300);
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("landing.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Check possible leak" }).click();
  await expect(
    page.getByRole("heading", { name: "A better look starts here." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("video report retains original evidence and saved status after reload", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await chooseVideo(page);
  await page.screenshot({
    path: testInfo.outputPath("scan.png"),
    fullPage: true,
  });
  await runAnalysis(page);
  await expect(
    page.getByText("Active flow probability", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("result.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Report for inspection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Submit report", exact: true }),
  ).toBeDisabled();
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 43.653, longitude: 51.164 });
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue(
    "43.653000",
  );
  await page
    .getByLabel("Nearby street or landmark")
    .fill("Test observation, microdistrict 14");
  await page
    .getByLabel("Anything else to add?")
    .fill("Water returning beside the kerb. Local test recording.");
  await noOverflow(page);
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(page.getByText("Report created", { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("created.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "View report in dashboard" }).click();
  const details = page.getByRole("region", { name: "Selected report details" });
  await expect(
    details.getByRole("heading", {
      name: "Test observation, microdistrict 14",
    }),
  ).toBeVisible();
  const evidence = page.getByLabel("Report video evidence");
  await expect(evidence).toBeVisible();
  await expect
    .poll(() => evidence.evaluate((node: HTMLVideoElement) => node.readyState))
    .toBeGreaterThanOrEqual(1);
  expect(
    await evidence.evaluate((node: HTMLVideoElement) => node.duration),
  ).toBeGreaterThanOrEqual(5);
  await page.getByLabel("Update report status").selectOption("IN_REVIEW");
  await page.getByRole("button", { name: "Save status", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /status saved/i }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Update report status")).toHaveValue(
    "IN_REVIEW",
  );
  await expect(page.getByLabel("Report video evidence")).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  await page.getByLabel("Risk level", { exact: true }).selectOption("LOW");
  await expect(
    details.getByRole("heading", {
      name: "Test observation, microdistrict 14",
    }),
  ).toHaveCount(0);
  await page.getByLabel("Status", { exact: true }).selectOption("IN_REVIEW");
  await expect(
    page.getByText("No matching reports", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("no water and uncertain outcomes suppress unsupported signals", async ({
  page,
}) => {
  await chooseVideo(page, "NO_WATER");
  await runAnalysis(page);
  await expect(
    page.getByRole("heading", {
      name: "No reliable water evidence detected",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Active flow probability", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Report for inspection", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Check another video", exact: true })
    .click();
  await page.getByLabel("Choose video file").setInputFiles(VIDEO);
  await page.getByLabel("Demo scenario").selectOption("UNCERTAIN");
  await runAnalysis(page);
  await expect(
    page.getByText("Evidence is insufficient for a reliable assessment.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record again", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Active flow probability", { exact: true }),
  ).toHaveCount(0);
});

test("invalid uploads, replacement and cancellation leave a usable scan", async ({
  page,
}) => {
  await page.goto("/scan");
  await page.getByLabel("Choose video file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a video"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Use an MP4",
  );
  await expect(
    page.getByRole("button", { name: "Run demo analysis" }),
  ).toBeDisabled();
  await page.getByLabel("Choose video file").setInputFiles(VIDEO);
  await expect(page.getByLabel("Selected video preview")).toBeVisible();
  await page.getByRole("button", { name: "Remove video" }).click();
  await expect(page.getByLabel("Selected video preview")).toHaveCount(0);
  await page.getByLabel("Choose video file").setInputFiles(VIDEO);
  await page.getByLabel("Demo scenario").selectOption("HIGH");
  await page.getByRole("button", { name: "Run demo analysis" }).click();
  await page.getByRole("button", { name: "Cancel analysis" }).click();
  await expect(
    page.getByRole("heading", { name: "A better look starts here." }),
  ).toBeVisible();
  await expect(page.getByLabel("Selected video preview")).toBeVisible();
});

for (const scenario of ["LOW", "MEDIUM"] as const) {
  test(`${scenario} scenario exposes its appropriate reporting path`, async ({
    page,
  }) => {
    await chooseVideo(page, scenario);
    await runAnalysis(page);
    await expect(
      page.getByText("Active flow probability", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name:
          scenario === "LOW"
            ? "Add a report for review"
            : "Report for inspection",
        exact: true,
      }),
    ).toBeVisible();
  });
}

test("map selection and unavailable geolocation allow manual reporting", async ({
  page,
}) => {
  await chooseVideo(page);
  await runAnalysis(page);
  await page
    .getByRole("button", { name: "Report for inspection", exact: true })
    .click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(
          _success: unknown,
          error: (error: { code: number }) => void,
        ) {
          error({ code: 1 });
        },
      },
    });
  });
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Location access was denied",
  );
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 150, y: 150 } });
  await expect(page.getByLabel("Latitude", { exact: true })).not.toHaveValue(
    "",
  );
  await expect(
    page.getByRole("button", { name: "Submit report", exact: true }),
  ).toBeEnabled();
});
