import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RecipeFun",
    short_name: "RecipeFun",
    description: "Collect, create and cook recipes step by step.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbf7f2",
    theme_color: "#c2410c",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
