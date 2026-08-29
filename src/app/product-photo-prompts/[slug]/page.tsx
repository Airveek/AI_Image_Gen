import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InteriorPageShell } from "@/components/airveek/interior-page-shell";
import { SeoContentPage } from "@/components/seo/seo-content-page";
import { canonicalMetadata } from "@/lib/seo/site";
import { getLiveSeoPage } from "@/features/seo/server/content";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getLiveSeoPage(`/product-photo-prompts/${(await params).slug}`);
  if (!page) return { title: "Product photo prompt" };
  return { title: page.title, description: page.meta_description, ...canonicalMetadata(page.path) };
}

export default async function ProductPhotoPromptPage({ params }: Props) {
  const value = await params;
  const page = await getLiveSeoPage(`/product-photo-prompts/${value.slug}`);
  if (!page) notFound();
  return <InteriorPageShell><SeoContentPage page={page} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Product photography", href: "/product-photography" }, { label: "Product photo prompts", href: "/product-photo-prompts" }, { label: page.title }]} /></InteriorPageShell>;
}
