import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InteriorPageShell } from "@/components/airveek/interior-page-shell";
import { SeoContentPage } from "@/components/seo/seo-content-page";
import { getLiveSeoPage } from "@/features/seo/server/content";
import { buildSeoMetadata } from "@/lib/seo/site";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getLiveSeoPage(`/tutorials/${(await params).slug}`);
  if (!page) return { title: "Airveek tutorial" };
  return buildSeoMetadata({ title: page.title, description: page.meta_description, pathname: page.path, type: "article" });
}

export default async function TutorialDetailPage({ params }: Props) {
  const value = await params;
  const page = await getLiveSeoPage(`/tutorials/${value.slug}`);
  if (!page) notFound();
  return <InteriorPageShell><SeoContentPage page={page} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Tutorials", href: "/tutorials" }, { label: page.title }]} /></InteriorPageShell>;
}
