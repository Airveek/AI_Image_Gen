import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InteriorPageShell } from "@/components/airveek/interior-page-shell";
import { SeoContentPage } from "@/components/seo/seo-content-page";
import { buildSeoMetadata } from "@/lib/seo/site";
import { getLiveSeoPage } from "@/features/seo/server/content";

type Props = { params: Promise<{ slug: string; job: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const value = await params;
  const page = await getLiveSeoPage(`/product-photography/${value.slug}/${value.job}`);
  if (!page) return { title: "Product photography workflow" };
  return buildSeoMetadata({ title: page.title, description: page.meta_description, pathname: page.path, type: "article" });
}

export default async function ProductPhotographyJobPage({ params }: Props) {
  const value = await params;
  const page = await getLiveSeoPage(`/product-photography/${value.slug}/${value.job}`);
  if (!page) notFound();
  return <InteriorPageShell><SeoContentPage page={page} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Product photography", href: "/product-photography" }, { label: value.slug, href: `/product-photography/${value.slug}` }, { label: page.title }]} /></InteriorPageShell>;
}
