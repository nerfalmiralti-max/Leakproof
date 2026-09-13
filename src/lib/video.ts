import type { VideoMetadata } from "@/domain/report";

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const EXTENSION_MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};
const METADATA_TIMEOUT_MS = 12_000;

function extensionOf(name: string): string {
  const match = /\.[^.]+$/.exec(name.trim().toLowerCase());
  return match?.[0] ?? "";
}

function normalizedType(file: Pick<File, "name" | "type">): string | null {
  const supplied = file.type.trim().toLowerCase();
  if (supplied) return SUPPORTED_MIME_TYPES.has(supplied) ? supplied : null;
  return EXTENSION_MIME_TYPES[extensionOf(file.name)] ?? null;
}

function abortError(): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted.", "AbortError");
  }
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

export function validateVideoFile(
  file: Pick<File, "name" | "type" | "size">,
): string | null {
  if (!file.name.trim()) return "Choose a named video file.";
  if (
    !Number.isFinite(file.size) ||
    !Number.isInteger(file.size) ||
    file.size <= 0
  ) {
    return "The video file is empty or invalid.";
  }
  if (file.size > MAX_VIDEO_BYTES) return "The video must be 50 MB or smaller.";
  if (!normalizedType(file)) return "Use an MP4, WebM, or QuickTime video.";
  return null;
}

export function validateVideoMetadata(meta: VideoMetadata): string | null {
  const fileError = validateVideoFile(meta);
  if (fileError) return fileError;
  if (
    !Number.isFinite(meta.duration) ||
    meta.duration < 5 ||
    meta.duration > 10
  ) {
    return "Record a video between 5 and 10 seconds long.";
  }
  if (
    !Number.isFinite(meta.width) ||
    !Number.isFinite(meta.height) ||
    meta.width <= 0 ||
    meta.height <= 0
  ) {
    return "The video dimensions could not be read.";
  }
  return null;
}

export async function readVideoMetadata(
  file: File,
  signal?: AbortSignal,
): Promise<VideoMetadata> {
  const fileError = validateVideoFile(file);
  if (fileError) throw new Error(fileError);
  if (signal?.aborted) throw abortError();
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error("Video metadata can only be read in a browser.");
  }

  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);
  video.preload = "metadata";

  return new Promise<VideoMetadata>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      video.onloadedmetadata = null;
      video.onerror = null;
      try {
        video.removeAttribute("src");
        video.load();
      } catch {
        // Cleanup must not mask the original decode, timeout, or abort error.
      }
      URL.revokeObjectURL(objectUrl);
    };
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };
    const onAbort = () => finish(() => reject(abortError()));
    const timeout = setTimeout(
      () =>
        finish(() =>
          reject(new Error("Timed out while reading video metadata.")),
        ),
      METADATA_TIMEOUT_MS,
    );

    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        name: file.name,
        size: file.size,
        type: normalizedType(file) ?? file.type,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      const metadataError = validateVideoMetadata(metadata);
      finish(() => {
        if (metadataError) reject(new Error(metadataError));
        else resolve(metadata);
      });
    };
    video.onerror = () =>
      finish(() =>
        reject(new Error("The browser could not read or play this video.")),
      );
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    video.src = objectUrl;
    try {
      video.load();
    } catch (error) {
      finish(() =>
        reject(
          new Error("The browser could not read or play this video.", {
            cause: error,
          }),
        ),
      );
    }
  });
}
