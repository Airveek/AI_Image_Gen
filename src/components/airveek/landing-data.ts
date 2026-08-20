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
  fit?: "contain" | "cover";
};

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  imageIndex: number;
  artwork?: Artwork;
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

export const galleryArtworks: Artwork[] = [
  { src: "/images/artistly/features/AI-Image/nickype-ai-generated-8783349_1920.jpg", width: 1086, height: 1920, alt: "AI-generated vertical fantasy artwork" },
  { src: "/images/artistly/features/AI-Image/StockCake-Gothic_Cathedral_Warrior-4972014-standard.png", width: 1408, height: 1408, alt: "AI-generated gothic cathedral warrior artwork" },
  { src: "/images/artistly/features/AI-Image/01-0429668-65bba28868e06.png", width: 1024, height: 1360, alt: "AI-generated portrait artwork" },
  { src: "/images/artistly/features/AI-Image/12-0315400-65a0b7e5f1c4c.png", width: 1024, height: 1360, alt: "AI-generated illustrated character artwork" },
  { src: "/images/artistly/features/AI-Image/07-0656752-6639ead607bd2.png", width: 1024, height: 1360, alt: "AI-generated fantasy character artwork" },
  { src: "/images/artistly/features/AI-Image/01-0427665-65baefc40c9e8.png", width: 1024, height: 1360, alt: "AI-generated astronaut artwork" },
  { src: "/images/artistly/features/AI-Image/18-0353466-65a9506e2dbb8.png", width: 1024, height: 1360, alt: "AI-generated portrait with glowing light artwork" },
  { src: "/images/artistly/features/AI-Image/07-0560076-65e984ea0be17.png", width: 1024, height: 1360, alt: "AI-generated tiger warrior artwork" },
  { src: "/images/artistly/features/AI-Image/13-0470100-65cb24b6b28e6.png", width: 1024, height: 1360, alt: "AI-generated fantasy illustration" },
  { src: "/images/artistly/features/AI-Image/22-1096280-6a393c2dcc74f.png", width: 896, height: 1200, alt: "AI-generated illustrated scene" },
  { src: "/images/artistly/features/AI-Image/17-0344968-65a7a11b019db.png", width: 1024, height: 1024, alt: "AI-generated square portrait artwork" },
  { src: "/images/artistly/features/AI-Image/StockCake-Pop_Art_Portrait-4952110-standard.png", width: 1024, height: 1024, alt: "AI-generated pop art portrait" },
  { src: "/images/artistly/features/AI-Image/StockCake-Cyberpunk_Canine_Glow-2204566-standard.png", width: 768, height: 1344, alt: "AI-generated cyberpunk canine artwork" },
  { src: "/images/artistly/features/AI-Image/StockCake-Ethereal_Anime_Magic-4713678-standard.png", width: 768, height: 1344, alt: "AI-generated ethereal anime magic artwork" },
  { src: "/images/artistly/features/AI-Image/StockCake-Industrial_Watercolor_Portrait-4968131-standard.png", width: 720, height: 1280, alt: "AI-generated industrial watercolor portrait" },
];

export const featureArtworks = {
  unlimitedAiImageCreator: { src: "/images/artistly/features/unlimited-ai-image-creator-v3.png", width: 1536, height: 1024, alt: "Luminous AI creativity studio with floating portrait, landscape, astronaut, perfume, and abstract artwork panels" },
  perfectTextInAiImages: { src: "/images/artistly/features/perfect-text-in-ai-images-v2.png", width: 1536, height: 1024, alt: "Premium coffee campaign poster with perfectly readable Summer Coffee Sale typography" },
  aiProductMockupCreator: { src: "/images/artistly/features/ai-product-mockup-creator-v2.png", width: 960, height: 1696, alt: "Airveek branded glowing water bottle product mockup suspended between crystalline rocks" },
  aiProductPhotographer: { src: "/images/artistly/features/ai-product-photographer-v2.png", width: 1254, height: 1254, alt: "Chocolate spread jar photographed in a miniature snowy mountain scene with tiny skiers" },
  instantSceneBackgroundEditor: { src: "/images/artistly/features/instant-scene-background-editor-v3.png", width: 1536, height: 1024, alt: "Surreal tropical scene with a scooter rider, tigers, palm trees, and a motion-blurred road" },
  smartImageExpander: { src: "/images/artistly/features/smart-image-expander-v2.png", width: 1536, height: 1024, alt: "Expanded panoramic alpine valley with a warmly lit cabin, winding river, and snow-capped mountains" },
  aiLogoMaker: { src: "/images/artistly/features/ai-logo-maker-v3.jpg", width: 1200, height: 1800, alt: "Futuristic black, gold, and electric blue gaming logo emblem" },
  canvasStyleImageEditor: { src: "/images/artistly/features/canvas-style-image-editor-v3.jpg", width: 1200, height: 1600, alt: "Painterly portrait surrounded by colorful expressive brush strokes" },
  coloringBookGenerator: { src: "/images/artistly/features/coloring-book-generator.png", width: 1536, height: 1024, alt: "Premium woodland coloring-book spread with colored pencils" },
  consistentCharacter: { src: "/images/artistly/features/consistent-character-v2.png", width: 1536, height: 1024, alt: "The same woman with an identical face across lavender, coral, and snowy scenes" },
  aiImageUpscaler: { src: "/images/artistly/features/ai-image-upscaler-v2.png", width: 1536, height: 1024, alt: "Kingfisher photo transitioning from visible pixels to sharp feather detail" },
  aiHumanInpainting: { src: "/images/artistly/features/ai-human-inpainting-v2.png", width: 1536, height: 1024, alt: "Portrait transformation with a brush boundary changing hair, clothing, and background" },
  aiStyleReplicator: { src: "/images/artistly/features/ai-style-replicator.png", width: 1536, height: 1024, alt: "Portrait, landscape, and floral artworks sharing one painterly style" },
  personalizedStorybookMaker: { src: "/images/artistly/features/personalized-storybook-maker.png", width: 1536, height: 1024, alt: "Child and fox discovering a glowing doorway in an enchanted forest" },
  talkingStorybookCreator: { src: "/images/artistly/features/talking-storybook-creator.png", width: 1536, height: 1024, alt: "Fox storyteller and child with glowing sound waves above an open storybook" },
  multilingualStorybookMaker: { src: "/images/artistly/features/multilingual-storybook-maker.png", width: 1536, height: 1024, alt: "Children from different cultures exploring one glowing storybook" },
  virtualModelCreator: { src: "/images/artistly/features/virtual-model-creator-v2.png", width: 1536, height: 1024, alt: "Three models wearing the same cobalt overshirt in a studio lookbook" },
  aiFashionDesigner: { src: "/images/artistly/features/ai-fashion-designer-v2.png", width: 1536, height: 1024, alt: "Couture model in a sapphire, tangerine, blush, and gold fashion design" },
  aiThumbnailMaker: { src: "/images/artistly/features/ai-thumbnail-maker.png", width: 1452, height: 1083, alt: "Creator holding a camera against bold cobalt, lime, and coral shapes", fit: "contain" },
  aiCharacterCreator: { src: "/images/artistly/features/ai-character-creator.png", width: 1536, height: 1024, alt: "Fantasy skyship captain with a floating mechanical companion" },
  bulkClipartDesigner: { src: "/images/artistly/features/bulk-clipart-designer.png", width: 1536, height: 1024, alt: "Collection of colorful standalone clipart illustrations" },
} satisfies Record<string, Artwork>;

export const features: Feature[] = [
  {
    title: "Unlimited AI Image Creator",
    description: "Turn a few words into professional visuals for marketing, social media, and presentations.",
    icon: WandSparkles,
    imageIndex: 0,
    artwork: featureArtworks.unlimitedAiImageCreator,
  },
  {
    title: "Perfect Text in AI Images",
    description: "Create posters, logos, shirts, and ads with readable text that looks right the first time.",
    icon: TypeIcon,
    imageIndex: 1,
    artwork: featureArtworks.perfectTextInAiImages,
    tag: "Popular",
  },
  {
    title: "AI Product Mockup Creator",
    description: "Put your designs on shirts, mugs, packaging, and more without a photoshoot.",
    icon: ShoppingBag,
    imageIndex: 2,
    artwork: featureArtworks.aiProductMockupCreator,
  },
  {
    title: "AI Product Photographer",
    description: "Place a product into polished scenes for your store, ads, or social posts.",
    icon: Camera,
    imageIndex: 3,
    artwork: featureArtworks.aiProductPhotographer,
  },
  {
    title: "Instant Scene Background Editor",
    description: "Replace backgrounds, refine lighting, and create realistic shadows in minutes.",
    icon: ImageIcon,
    imageIndex: 4,
    artwork: featureArtworks.instantSceneBackgroundEditor,
  },
  {
    title: "Smart Image Expander",
    description: "Extend an image beyond its edges and fill in the missing details naturally.",
    icon: Expand,
    imageIndex: 5,
    artwork: featureArtworks.smartImageExpander,
  },
  {
    title: "AI Logo Maker",
    description: "Create editable logos and brand assets with a simple prompt and unlimited revisions.",
    icon: PenTool,
    imageIndex: 6,
    artwork: featureArtworks.aiLogoMaker,
  },
  {
    title: "Canvas-Style Image Editor",
    description: "Add text, graphics, and effects with a simple drag-and-drop editing workflow.",
    icon: LayoutTemplate,
    imageIndex: 7,
    artwork: featureArtworks.canvasStyleImageEditor,
  },
  {
    title: "Coloring Book Generator",
    description: "Make kid-friendly coloring pages for activities, books, gifts, or Etsy products.",
    icon: Palette,
    imageIndex: 8,
    artwork: featureArtworks.coloringBookGenerator,
    tag: "New",
  },
  {
    title: "Consistent Character",
    description: "Keep a character looking the same across scenes, outfits, stories, and brand content.",
    icon: Users,
    imageIndex: 9,
    artwork: featureArtworks.consistentCharacter,
  },
  {
    title: "AI Image Upscaler",
    description: "Increase image size and sharpness for high-quality downloads and print projects.",
    icon: Sparkles,
    imageIndex: 10,
    artwork: featureArtworks.aiImageUpscaler,
  },
  {
    title: "AI Human Inpainting",
    description: "Change hair, clothing, accessories, and backgrounds with one simple prompt.",
    icon: Eraser,
    imageIndex: 11,
    artwork: featureArtworks.aiHumanInpainting,
  },
  {
    title: "AI Style Replicator",
    description: "Upload a style reference and create new artwork that keeps the look and feel consistent.",
    icon: Palette,
    imageIndex: 2,
    artwork: featureArtworks.aiStyleReplicator,
  },
  {
    title: "Personalized Storybook Maker",
    description: "Create illustrated stories with personal details, custom characters, and ready-to-share pages.",
    icon: BookOpen,
    imageIndex: 3,
    artwork: featureArtworks.personalizedStorybookMaker,
    tag: "New",
  },
  {
    title: "Talking Storybook Creator",
    description: "Add lifelike narration to story pages for immersive digital and educational experiences.",
    icon: WandSparkles,
    imageIndex: 5,
    artwork: featureArtworks.talkingStorybookCreator,
    tag: "New",
  },
  {
    title: "Multilingual Storybook Maker",
    description: "Translate and customize stories for bilingual families, learners, and global audiences.",
    icon: BookOpen,
    imageIndex: 7,
    artwork: featureArtworks.multilingualStorybookMaker,
    tag: "New",
  },
  {
    title: "Virtual Model Creator",
    description: "Place your designs on realistic models for ecommerce listings without a studio shoot.",
    icon: Users,
    imageIndex: 6,
    artwork: featureArtworks.virtualModelCreator,
  },
  {
    title: "AI Fashion Designer",
    description: "Change outfits, textures, colors, and accessories with a simple prompt.",
    icon: Shirt,
    imageIndex: 9,
    artwork: featureArtworks.aiFashionDesigner,
  },
  {
    title: "AI Thumbnail Maker",
    description: "Turn a title or topic into bold thumbnails for YouTube, blogs, and social media.",
    icon: Megaphone,
    imageIndex: 10,
    artwork: featureArtworks.aiThumbnailMaker,
    tag: "New",
  },
  {
    title: "AI Character Creator",
    description: "Describe a hero, sidekick, or villain and create an original character for your story or game.",
    icon: Users,
    imageIndex: 1,
    artwork: featureArtworks.aiCharacterCreator,
  },
  {
    title: "Bulk Clipart Designer",
    description: "Generate a large collection of unique clipart from one prompt for digital products and stickers.",
    icon: Layers3,
    imageIndex: 8,
    artwork: featureArtworks.bulkClipartDesigner,
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
