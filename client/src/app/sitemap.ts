import type { MetadataRoute } from "next";
import { APP_INFO } from "@/config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: APP_INFO.url,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
