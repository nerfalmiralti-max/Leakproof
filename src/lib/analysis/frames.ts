import type { VideoMetadata } from "@/domain/report";
import { validateVideoMetadata } from "@/lib/video";

export type VideoFrame = { time: number; image: string };
export const FRAME_COUNT = 6;

function waitForVideo(
  video: HTMLVideoElement,
  event: "loadeddata" | "seeked",
  signal?: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      video.removeEventListener(event, ready);
      video.removeEventListener("error", failed);
      signal?.removeEventListener("abort", aborted);
      if (error) reject(error);
      else resolve();
    };
    const ready = () => finish();
    const failed = () =>
      finish(
        new Error(
          "Video frames could not be decoded. Try another MP4 or WebM recording.",
        ),
      );
    const aborted = () =>
      finish(new DOMException("Analysis cancelled.", "AbortError"));
    const timer = setTimeout(
      () =>
        finish(new Error("Frame extraction timed out. Try another recording.")),
      6000,
    );
    video.addEventListener(event, ready, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) aborted();
  });
}

export async function extractVideoFrames(
  source: Blob,
  metadata: VideoMetadata,
  signal?: AbortSignal,
): Promise<VideoFrame[]> {
  if (!(source instanceof Blob) || source.size !== metadata.size)
    throw new Error("The video file is invalid.");
  const video = document.createElement("video");
  const url = URL.createObjectURL(source);
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const canvas = document.createElement("canvas");
  try {
    const loaded = waitForVideo(video, "loadeddata", signal);
    video.src = url;
    video.load();
    await loaded;
    const error = validateVideoMetadata({
      ...metadata,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    });
    if (error) throw new Error(error);
    const scale = Math.min(
      1,
      960 / Math.max(video.videoWidth, video.videoHeight),
    );
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot extract video frames.");
    const frames: VideoFrame[] = [];
    for (let index = 0; index < FRAME_COUNT; index++) {
      if (signal?.aborted)
        throw new DOMException("Analysis cancelled.", "AbortError");
      const time = 0.1 + ((video.duration - 0.2) * index) / (FRAME_COUNT - 1);
      const sought = waitForVideo(video, "seeked", signal);
      video.currentTime = time;
      await sought;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      let image = canvas.toDataURL("image/jpeg", 0.72);
      if (image.length > 350_000) image = canvas.toDataURL("image/jpeg", 0.45);
      if (
        image.length > 350_000 ||
        !image.startsWith("data:image/jpeg;base64,")
      )
        throw new Error(
          "Video frames are too large to analyse. Try a lower-resolution recording.",
        );
      frames.push({ time: Number(time.toFixed(3)), image });
    }
    return frames;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}
