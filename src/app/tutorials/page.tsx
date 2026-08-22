import type { Metadata } from "next";
import { TutorialsPage } from "@/components/airveek/tutorials-page";

export const metadata: Metadata = {
  title: "Tutorials",
  description: "Learn how to create images, product visuals, logos, storybooks, thumbnails, and more with Airveek.",
};

export default function TutorialsRoute() {
  return <TutorialsPage />;
}
