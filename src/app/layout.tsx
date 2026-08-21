import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, K2D } from "next/font/google";
import { AppToaster } from "@/components/ui/app-toaster";
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
  title: {
    default: "Airveek: All-in-One AI Image Generator",
    template: "%s | Airveek",
  },
  description:
    "Create images, logos, and commercial artwork from a keyword with Airveek.",
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
        <AppToaster />
      </body>
    </html>
  );
}
