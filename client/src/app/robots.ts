import type { MetadataRoute } from "next";
import { APP_INFO } from "@/config";

export default function robots(): MetadataRoute.Robots {
  if (!APP_INFO.indexable) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${APP_INFO.url}/sitemap.xml`,
  };
}
