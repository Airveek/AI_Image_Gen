import type { Metadata } from "next";
import { TutorialsPage } from "@/components/airveek/tutorials-page";
import { buildSeoMetadata } from "@/lib/seo/site";

export const metadata: Metadata = buildSeoMetadata({ title: "Tutorials", description: "Learn how to create images, product visuals, logos, storybooks, thumbnails, and more with Airveek.", pathname: "/tutorials" });

export default function TutorialsRoute() {
  return <TutorialsPage />;
}
