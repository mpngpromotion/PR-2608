import type { MetadataRoute } from "next";
import { APP_INFO } from "@/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_INFO.name,
    short_name: "Layer [EP]",
    description: APP_INFO.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icons/android-icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/android-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
