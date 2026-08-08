import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ActionHQ — Social Performance for Indoor Cricket",
    short_name: "ActionHQ",
    description: "Track matches, compare performance and celebrate your Action Cricket team.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f1",
    theme_color: "#071e2b",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
