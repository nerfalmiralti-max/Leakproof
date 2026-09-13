import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_VIDEO_BYTES,
  readVideoMetadata,
  validateVideoFile,
  validateVideoMetadata,
} from "@/lib/video";

const validMetadata = {
  name: "leak.mp4",
  size: 2_048,
  type: "video/mp4",
  duration: 6,
  width: 1920,
  height: 1080,
};

describe("video validation", () => {
  it.each([
    { name: "leak.mp4", type: "video/mp4" },
    { name: "leak.webm", type: "video/webm" },
    { name: "leak.mov", type: "video/quicktime" },
    { name: "camera.MP4", type: "" },
  ])("accepts supported browser video $name", ({ name, type }) => {
    expect(validateVideoFile({ name, type, size: 1 })).toBeNull();
  });

  it("rejects empty and oversized files", () => {
    expect(
      validateVideoFile({ name: "a.mp4", type: "video/mp4", size: 0 }),
    ).toMatch(/empty/i);
    expect(
      validateVideoFile({
        name: "a.mp4",
        type: "video/mp4",
        size: MAX_VIDEO_BYTES + 1,
      }),
    ).toMatch(/50 MB/i);
  });

  it("rejects unsupported formats, including a conflicting MIME type", () => {
    expect(
      validateVideoFile({ name: "a.avi", type: "video/x-msvideo", size: 1 }),
    ).toMatch(/MP4|WebM|QuickTime/);
    expect(
      validateVideoFile({ name: "a.mp4", type: "text/plain", size: 1 }),
    ).toMatch(/MP4|WebM|QuickTime/);
  });

  it.each([4.99, 10.01, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects unsafe duration %s",
    (duration) => {
      expect(validateVideoMetadata({ ...validMetadata, duration })).toMatch(
        /5.*10/,
      );
    },
  );

  it.each([
    { width: 0, height: 1080 },
    { width: 1920, height: 0 },
    { width: Number.NaN, height: 1080 },
    { width: 1920, height: Number.POSITIVE_INFINITY },
  ])("rejects invalid dimensions $width x $height", ({ width, height }) => {
    expect(validateVideoMetadata({ ...validMetadata, width, height })).toMatch(
      /dimensions/i,
    );
  });
});

describe("metadata reader", () => {
  const originalDocument = globalThis.document;
  const originalURL = globalThis.URL;

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: originalURL,
    });
  });

  it("revokes its object URL after reading metadata", async () => {
    const video = {
      preload: "",
      src: "",
      duration: 6,
      videoWidth: 1280,
      videoHeight: 720,
      onloadedmetadata: null as null | (() => void),
      onerror: null as null | (() => void),
      load() {
        queueMicrotask(() => this.onloadedmetadata?.());
      },
      removeAttribute: vi.fn(),
    };
    const revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: () => video },
    });
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: { createObjectURL: () => "blob:test", revokeObjectURL },
    });
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });

    await expect(readVideoMetadata(file)).resolves.toMatchObject({
      duration: 6,
      width: 1280,
      height: 720,
    });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    expect(video.removeAttribute).toHaveBeenCalledWith("src");
  });

  it("revokes its object URL when browser decoding fails", async () => {
    const video = {
      preload: "",
      src: "",
      onloadedmetadata: null as null | (() => void),
      onerror: null as null | (() => void),
      load() {
        queueMicrotask(() => this.onerror?.());
      },
      removeAttribute: vi.fn(),
    };
    const revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: () => video },
    });
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: { createObjectURL: () => "blob:bad", revokeObjectURL },
    });
    const file = new File(["bad"], "clip.mp4", { type: "video/mp4" });

    await expect(readVideoMetadata(file)).rejects.toThrow(/could not read/i);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:bad");
  });

  it("times out and releases browser resources when metadata never loads", async () => {
    vi.useFakeTimers();
    const video = {
      preload: "",
      src: "",
      onloadedmetadata: null as null | (() => void),
      onerror: null as null | (() => void),
      load: vi.fn(),
      removeAttribute: vi.fn(),
    };
    const revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: () => video },
    });
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: { createObjectURL: () => "blob:stalled", revokeObjectURL },
    });
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });

    const metadata = readVideoMetadata(file);
    const rejection = expect(metadata).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(12_000);

    await rejection;
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:stalled");
  });

  it("honors an already-aborted signal before allocating browser resources", async () => {
    const createObjectURL = vi.fn();
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: { createObjectURL, revokeObjectURL: vi.fn() },
    });
    const controller = new AbortController();
    controller.abort();
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });

    await expect(
      readVideoMetadata(file, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("releases browser resources when metadata reading is cancelled", async () => {
    const video = {
      preload: "",
      src: "",
      onloadedmetadata: null as null | (() => void),
      onerror: null as null | (() => void),
      load: vi.fn(),
      removeAttribute: vi.fn(),
    };
    const revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: () => video },
    });
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: { createObjectURL: () => "blob:cancel", revokeObjectURL },
    });
    const controller = new AbortController();
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });

    const metadata = readVideoMetadata(file, controller.signal);
    const rejection = expect(metadata).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();

    await rejection;
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cancel");
  });
});
