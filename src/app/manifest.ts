import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeakProof — Aktau water reporting",
    short_name: "LeakProof",
    description:
      "Record and report possible water leaks. Demonstration application.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f5",
    theme_color: "#173e36",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
