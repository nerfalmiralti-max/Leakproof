import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { once } from "node:events";

// Optional fixture regeneration. Requires an FFmpeg executable with VP8 support.
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
});
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.setContent(
    '<body style="margin:0;background:#e8efdf;color:#173e36;display:grid;place-content:center;height:100vh;text-align:center;font-family:Arial"><h1>LeakProof test recording</h1><p>Generated video fixture · No real water evidence</p><p>7 seconds / 640 × 360 / VP8</p></body>',
  );
  const frame = await page.screenshot({ type: "jpeg", quality: 85 });
  await mkdir("tests/fixtures", { recursive: true });
  for (const [name, frames] of [
    ["observation", 70],
    ["too-short", 30],
  ]) {
    const encoder = spawn(
      process.env.FFMPEG_PATH || "ffmpeg",
      [
        "-y",
        "-f",
        "image2pipe",
        "-c:v",
        "mjpeg",
        "-r",
        "10",
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "libvpx",
        "-b:v",
        "150k",
        "-f",
        "webm",
        `tests/fixtures/${name}.webm`,
      ],
      { windowsHide: true },
    );
    let stderr = "";
    encoder.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const completed = once(encoder, "close");
    for (let index = 0; index < frames; index++) encoder.stdin.write(frame);
    encoder.stdin.end();
    const [code] = await completed;
    if (code !== 0) throw new Error(stderr);
    console.log(`Created tests/fixtures/${name}.webm (${frames / 10}s)`);
  }
} finally {
  await browser.close();
}
