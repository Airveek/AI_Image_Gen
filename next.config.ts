import type { NextConfig } from "next";

const siteHostname = readSiteHostname(process.env.NEXT_PUBLIC_SITE_URL);
const mediaHostnames = new Set([
  siteHostname,
  "i.ytimg.com",
  ...(process.env.APINDEX_STORE_MEDIA_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
]);
const privateRouteHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];
const nonIndexableQueryKeys = [
  "sort", "order", "filter", "category", "type", "q", "query", "search", "cursor", "limit", "page",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "dclid", "fbclid", "msclkid", "ttclid", "ref", "referrer", "source", "variant",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: process.cwd(),
  images: {
    qualities: [75, 90],
    remotePatterns: [...mediaHostnames].map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "www.airveek.com" }],
        destination: "https://airveek.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: privateRouteHeaders,
      },
      {
        source: "/auth/:path*",
        headers: privateRouteHeaders,
      },
      {
        source: "/login",
        headers: privateRouteHeaders,
      },
      {
        source: "/register",
        headers: privateRouteHeaders,
      },
      {
        source: "/admin/:path*",
        headers: privateRouteHeaders,
      },
      {
        source: "/dashboard/:path*",
        headers: privateRouteHeaders,
      },
      {
        source: "/library/:path*",
        headers: privateRouteHeaders,
      },
      {
        source: "/store-images/:path*",
        headers: privateRouteHeaders,
      },
      {
        source: "/create/:path*",
        headers: privateRouteHeaders,
      },
      {
        source: "/preview/:path*",
        headers: privateRouteHeaders,
      },
      {
        source: "/checkout/:path*",
        headers: privateRouteHeaders,
      },
      // Query variants are navigation/attribution views, not canonical SEO
      // documents. Match the known filter and campaign keys at the CDN layer
      // so a static/ISR page cannot be stored as a public cache entry when a
      // query-string request is made. The proxy still covers unknown keys with
      // X-Robots-Tag: noindex.
      ...nonIndexableQueryKeys.map((key) => ({
        source: "/:path*",
        has: [{ type: "query" as const, key }],
        headers: privateRouteHeaders,
      })),
    ];
  },
  async rewrites() {
    return [{ source: "/sitemaps/:shard.xml", destination: "/sitemaps/:shard" }];
  },
};

export default nextConfig;

function readSiteHostname(value: string | undefined): string {
  try {
    return new URL(value?.trim() || "https://airveek.com").hostname;
  } catch {
    return "airveek.com";
  }
}
