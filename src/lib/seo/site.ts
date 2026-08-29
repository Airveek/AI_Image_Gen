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
