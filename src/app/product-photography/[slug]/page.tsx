import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InteriorPageShell } from "@/components/airveek/interior-page-shell";
import { SeoContentPage } from "@/components/seo/seo-content-page";
import { buildSeoMetadata } from "@/lib/seo/site";
import { getLiveSeoPage } from "@/features/seo/server/content";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getLiveSeoPage(`/product-photography/${(await params).slug}`);
  if (!page) return { title: "Product photography guide" };
  return buildSeoMetadata({ title: page.title, description: page.meta_description, pathname: page.path, type: "article" });
}

export default async function ProductPhotographyPage({ params }: Props) {
  const page = await getLiveSeoPage(`/product-photography/${(await params).slug}`);
  if (!page) notFound();
  return <InteriorPageShell><SeoContentPage page={page} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Product photography", href: "/product-photography" }, { label: page.title }]} /></InteriorPageShell>;
}
