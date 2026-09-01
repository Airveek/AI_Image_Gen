import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { Inter, K2D } from "next/font/google";
import { absoluteUrl, SITE_URL, siteVerification } from "@/lib/seo/site";
import { ConsentAndAttribution } from "@/components/seo/consent-and-attribution";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const k2d = K2D({
  variable: "--font-k2d",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  verification: siteVerification(),
  title: {
    default: "Airveek: All-in-One AI Image Generator",
    template: "%s | Airveek",
  },
  description:
    "Create images, logos, and commercial artwork from a keyword with Airveek.",
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    type: "website",
    siteName: "Airveek",
    url: absoluteUrl("/"),
    title: "Airveek: All-in-One AI Image Generator",
    description: "Create images, logos, and commercial artwork from a keyword with Airveek.",
    images: [{ url: absoluteUrl("/images/airveek/hero-premium-generated.png"), width: 1536, height: 1024, alt: "Airveek AI image creation studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Airveek: All-in-One AI Image Generator",
    description: "Create images, logos, and commercial artwork from a keyword with Airveek.",
    images: [absoluteUrl("/images/airveek/hero-premium-generated.png")],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/images/airveek/mark-square.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${k2d.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
        <Analytics />
        <ConsentAndAttribution />
      </body>
    </html>
  );
}
