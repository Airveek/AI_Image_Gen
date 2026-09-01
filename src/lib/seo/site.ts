import type { Metadata } from "next";

const DEFAULT_SITE_URL = "https://airveek.com";

function normalizeSiteUrl(value: string): string {
  const candidate = value.trim();
  if (!candidate) return DEFAULT_SITE_URL;

  try {
    const url = new URL(candidate);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL,
);

const DEFAULT_SOCIAL_IMAGE = "/images/airveek/hero-premium-generated.png";

export function buildSeoMetadata(input: {
  title: string;
  description: string;
  pathname: string;
  imagePath?: string;
  type?: "website" | "article";
}): Metadata {
  const url = absoluteUrl(input.pathname);
  const imageUrl = absoluteUrl(input.imagePath ?? DEFAULT_SOCIAL_IMAGE);
  return {
    title: input.title,
    description: input.description,
    ...canonicalMetadata(input.pathname),
    openGraph: {
      type: input.type ?? "website",
      siteName: "Airveek",
      url,
      title: input.title,
      description: input.description,
      images: [{ url: imageUrl, width: 1536, height: 1024, alt: `${input.title} — Airveek` }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [imageUrl],
    },
  };
}

export function siteVerification(): Metadata["verification"] | undefined {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.BING_SITE_VERIFICATION?.trim();
  if (!google && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

export function absoluteUrl(pathname = "/"): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_URL}${path === "/" ? "/" : path.replace(/\/$/, "")}`;
}

export function canonicalMetadata(pathname: string): Pick<Metadata, "alternates"> {
  return { alternates: { canonical: absoluteUrl(pathname) } };
}

export const noIndexMetadata: Pick<Metadata, "robots"> = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      noarchive: true,
      nosnippet: true,
    },
  },
};
