import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Eraser,
  Expand,
  ImageIcon,
  Layers3,
  LayoutTemplate,
  Megaphone,
  Palette,
  PenTool,
  Shirt,
  ShoppingBag,
  Sparkles,
  Type as TypeIcon,
  Users,
  WandSparkles,
} from "lucide-react";

export type Artwork = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  imageIndex: number;
  tag?: string;
};

export type Audience = {
  title: string;
  description: string;
  icon: LucideIcon;
  imageIndex: number;
};

export const artworks: Artwork[] = [
  { src: "/images/airveek/unlock/slider/ul-s1.png", width: 244, height: 302, alt: "Colorful illustrated character artwork" },
  { src: "/images/airveek/unlock/slider/ul-s2.png", width: 300, height: 300, alt: "AI-generated portrait artwork" },
  { src: "/images/airveek/unlock/slider/ul-s3.png", width: 220, height: 300, alt: "AI-generated fantasy artwork" },
  { src: "/images/airveek/unlock/slider/ul-s4.png", width: 220, height: 300, alt: "AI-generated illustrated artwork" },
  { src: "/images/airveek/unlock/slider/ul-s5.png", width: 220, height: 250, alt: "AI-generated product artwork" },
  { src: "/images/airveek/unlock/slider/ul-s6.png", width: 300, height: 250, alt: "AI-generated landscape artwork" },
  { src: "/images/airveek/unlock/slider/ul-s7.png", width: 220, height: 300, alt: "AI-generated character artwork" },
  { src: "/images/airveek/unlock/slider/ul-s8.png", width: 220, height: 250, alt: "AI-generated colorful artwork" },
  { src: "/images/airveek/unlock/slider/ul-s9.png", width: 220, height: 300, alt: "AI-generated editorial artwork" },
  { src: "/images/airveek/unlock/slider/ul-s10.png", width: 300, height: 250, alt: "AI-generated scene artwork" },
  { src: "/images/airveek/unlock/slider/ul-s11.png", width: 220, height: 300, alt: "AI-generated digital art" },
  { src: "/images/airveek/unlock/slider/ul-s12.png", width: 220, height: 300, alt: "AI-generated fantasy portrait" },
];

export const features: Feature[] = [
  {
    title: "Unlimited AI Image Creator",
    description: "Turn a few words into professional visuals for marketing, social media, and presentations.",
    icon: WandSparkles,
    imageIndex: 0,
  },
  {
    title: "Perfect Text in AI Images",
    description: "Create posters, logos, shirts, and ads with readable text that looks right the first time.",
    icon: TypeIcon,
    imageIndex: 1,
    tag: "Popular",
  },
  {
    title: "AI Product Mockup Creator",
    description: "Put your designs on shirts, mugs, packaging, and more without a photoshoot.",
    icon: ShoppingBag,
    imageIndex: 2,
  },
  {
    title: "AI Product Photographer",
    description: "Place a product into polished scenes for your store, ads, or social posts.",
    icon: Camera,
    imageIndex: 3,
  },
  {
    title: "Instant Scene Background Editor",
    description: "Replace backgrounds, refine lighting, and create realistic shadows in minutes.",
    icon: ImageIcon,
    imageIndex: 4,
  },
  {
    title: "Smart Image Expander",
    description: "Extend an image beyond its edges and fill in the missing details naturally.",
    icon: Expand,
    imageIndex: 5,
  },
  {
    title: "AI Logo Maker",
    description: "Create editable logos and brand assets with a simple prompt and unlimited revisions.",
    icon: PenTool,
    imageIndex: 6,
  },
  {
    title: "Canvas-Style Image Editor",
    description: "Add text, graphics, and effects with a simple drag-and-drop editing workflow.",
    icon: LayoutTemplate,
    imageIndex: 7,
  },
  {
    title: "Coloring Book Generator",
    description: "Make kid-friendly coloring pages for activities, books, gifts, or Etsy products.",
    icon: Palette,
    imageIndex: 8,
    tag: "New",
  },
  {
    title: "Consistent Character",
    description: "Keep a character looking the same across scenes, outfits, stories, and brand content.",
    icon: Users,
    imageIndex: 9,
  },
  {
    title: "AI Image Upscaler",
    description: "Increase image size and sharpness for high-quality downloads and print projects.",
    icon: Sparkles,
    imageIndex: 10,
  },
  {
    title: "AI Human Inpainting",
    description: "Change hair, clothing, accessories, and backgrounds with one simple prompt.",
    icon: Eraser,
    imageIndex: 11,
  },
  {
    title: "AI Style Replicator",
    description: "Upload a style reference and create new artwork that keeps the look and feel consistent.",
    icon: Palette,
    imageIndex: 2,
  },
  {
    title: "Personalized Storybook Maker",
    description: "Create illustrated stories with personal details, custom characters, and ready-to-share pages.",
    icon: BookOpen,
    imageIndex: 3,
    tag: "New",
  },
  {
    title: "Talking Storybook Creator",
    description: "Add lifelike narration to story pages for immersive digital and educational experiences.",
    icon: WandSparkles,
    imageIndex: 5,
    tag: "New",
  },
  {
    title: "Multilingual Storybook Maker",
    description: "Translate and customize stories for bilingual families, learners, and global audiences.",
    icon: BookOpen,
    imageIndex: 7,
    tag: "New",
  },
  {
    title: "Virtual Model Creator",
    description: "Place your designs on realistic models for ecommerce listings without a studio shoot.",
    icon: Users,
    imageIndex: 6,
  },
  {
    title: "AI Fashion Designer",
    description: "Change outfits, textures, colors, and accessories with a simple prompt.",
    icon: Shirt,
    imageIndex: 9,
  },
  {
    title: "AI Thumbnail Maker",
    description: "Turn a title or topic into bold thumbnails for YouTube, blogs, and social media.",
    icon: Megaphone,
    imageIndex: 10,
    tag: "New",
  },
  {
    title: "AI Character Creator",
    description: "Describe a hero, sidekick, or villain and create an original character for your story or game.",
    icon: Users,
    imageIndex: 1,
  },
  {
    title: "Bulk Clipart Designer",
    description: "Generate a large collection of unique clipart from one prompt for digital products and stickers.",
    icon: Layers3,
    imageIndex: 8,
    tag: "New",
  },
];

export const audiences: Audience[] = [
  { title: "Print-on-Demand", description: "T-shirts, mugs, hoodies, and merchandise", icon: Shirt, imageIndex: 0 },
  { title: "Ecommerce", description: "Product photos, scenes, and mockups", icon: ShoppingBag, imageIndex: 2 },
  { title: "Marketing", description: "Ads, posters, social graphics, and banners", icon: Megaphone, imageIndex: 4 },
  { title: "Digital Products", description: "Coloring pages, printables, and book covers", icon: BookOpen, imageIndex: 8 },
  { title: "Freelance Work", description: "Create polished graphics for clients", icon: BriefcaseBusiness, imageIndex: 6 },
  { title: "Personal Creativity", description: "Art, characters, portraits, and ideas", icon: Sparkles, imageIndex: 1 },
];

export const useCases = [
  { title: "Social media", description: "Generate tailored visuals that stop the scroll.", icon: Users },
  { title: "Advertising", description: "Create campaign images for digital and print.", icon: Megaphone },
  { title: "Website design", description: "Add custom images, illustrations, and graphics.", icon: LayoutTemplate },
  { title: "Product mockups", description: "Show realistic products without a studio.", icon: ShoppingBag },
  { title: "Logo and branding", description: "Build a memorable visual identity faster.", icon: PenTool },
  { title: "Digital art", description: "Explore original artwork and illustrations.", icon: Palette },
  { title: "Educational materials", description: "Make engaging diagrams and classroom visuals.", icon: BookOpen },
  { title: "Event promotion", description: "Create posters and social assets in minutes.", icon: Sparkles },
  { title: "Presentations", description: "Make every slide more visual and memorable.", icon: ImageIcon },
];

export const recapFeatures = [
  "AI prompt-to-image generator",
  "Magic Merch product mockups",
  "AI style replicator",
  "Instant scene background changer",
  "Canvas-style image editor",
  "Coloring book maker",
  "AI logo maker",
  "T-shirt design generator",
  "AI image upscaler",
  "AI image redesigner",
  "Smart image expander",
  "Personalized storybook maker",
  "Talking storybook creator",
  "Multilingual storybook maker",
  "Script-to-storybook maker",
  "Virtual model creator",
  "AI product photographer",
  "AI fashion designer",
  "AI thumbnail maker",
  "AI character creator",
  "Bulk clipart designer",
  "AI human inpainting",
  "Perfect text in AI images",
  "HD image downloads",
  "No watermarks",
  "Commercial license",
  "Free product updates",
  "30-day money-back guarantee",
];

export const faqs = [
  {
    question: "How is Airveek different from other apps?",
    answer: "Airveek brings image generation, editing, mockups, background tools, upscaling, and commercial-ready workflows into one simple creative suite. You pay once instead of stacking monthly subscriptions.",
  },
  {
    question: "Does it include unlimited design generation?",
    answer: "The Airveek offer is built around unlimited design creation with no monthly fees. Your plan details and usage terms are shown clearly at checkout.",
  },
  {
    question: "Can I use my designs commercially?",
    answer: "Yes. The commercial plan is designed for client work, marketing, digital products, print-on-demand, and other commercial projects according to the license terms.",
  },
  {
    question: "Are there monthly or hidden costs?",
    answer: "No. The offer is a one-time payment, with no monthly charge or surprise upsell required to use the core product.",
  },
  {
    question: "Is there a money-back guarantee?",
    answer: "Yes. Airveek includes a 30-day money-back guarantee so you can try the workflow with less risk.",
  },
  {
    question: "Do I need design or AI experience?",
    answer: "No. Start with a keyword or a short prompt, choose a style or setting, and review the generated results. The workflow is made for beginners.",
  },
  {
    question: "Can Airveek create logos and original artwork?",
    answer: "Yes. Create logos, illustrations, characters, book covers, posters, product visuals, and more from simple prompts, then keep refining them.",
  },
  {
    question: "Can I create product photos without a photoshoot?",
    answer: "Yes. Use product mockups, virtual models, and scene backgrounds to present products in polished settings without hiring a photographer.",
  },
  {
    question: "Are there any upsells?",
    answer: "The plans are shown upfront. You can choose the commercial plan or the premium plan based on the tools and usage you need.",
  },
  {
    question: "Are step-by-step tutorials included?",
    answer: "Airveek includes a simple workflow and supporting training resources so you can move from idea to finished visual without a complicated setup.",
  },
];
