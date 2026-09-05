import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/auth/",
          "/checkout/",
          "/dashboard/",
          "/library/",
          "/store-images/",
          "/create/",
          "/login",
          "/register",
          "/preview/",
          "/playground/",
          "/search",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
