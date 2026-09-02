"use client";

import { Play, Search, Sparkles } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { InteriorHero, InteriorPageShell } from "./interior-page-shell";

type Tutorial = {
  title: string;
  category: string;
  videoId: string;
  featured?: boolean;
};

const tutorials: Tutorial[] = [
  { category: "AI Image Designer V6", title: "How To Use Create From Prompt Feature", videoId: "gqyxq7s2QL4" },
  { category: "AI Image Designer V6", title: "How To Create a Logo", videoId: "ST_a88Va9zc" },
  { category: "AI Image Designer V6", title: "How To Use The Photorealism Feature", videoId: "DYCkPc2OANc" },
  { category: "AI Image Designer V6", title: "How To Use The Animal Feature", videoId: "AKZXS5VkXbY" },
  { category: "AI Image Designer V6", title: "How To Create T Shirt Designs Using Fast AI", videoId: "vIL_cV4FPYY" },
  { category: "AI Image Designer V6", title: "How To Create Social Media Posts Using Fast AI", videoId: "Xp8RY6N-KT4" },
  { category: "AI Design Agents", title: "Create Personalized Pet Portraits That Sell on Etsy", videoId: "odI36numdR8" },
  { category: "AI Design Agents", title: "How To Create a Soulmate Sketch Using Fast AI", videoId: "tmQz1EOXmKE" },
  { category: "AI Design Agents", title: "How To Use Script To Storyboard Feature", videoId: "0CGGWD-Sf_I" },
  { category: "AI Design Agents", title: "How To Use YouTube Thumbnail Feature", videoId: "y63JZi3JINc" },
  { category: "AI Design Agents", title: "How To Create Personalized Storybooks", videoId: "s5BC-HJTh2Y" },
  { category: "Integrations", title: "VideoExpress.ai + Airveek + CloneVoice.ai Integration", videoId: "NNO2PTN-aDs" },
  { category: "Integrations", title: "Integrating CloneVoice.ai and Airveek", videoId: "bAt1XwU9udE" },
  { category: "AI Storybook Studio", title: "How To Use The AI Storybook Studio", videoId: "ZMvJgSgAdCs" },
  { category: "AI Storybook Studio", title: "Turn Your Child Into the Hero of Their Own Storybook", videoId: "3UAdN9_BD24" },
  { category: "AI Storybook Studio", title: "Create Fully Illustrated Bible Stories for Young Children", videoId: "qm2rwKSBObg" },
  { category: "AI Storybook Studio", title: "Create Illustrated Books With Multiple Consistent Characters", videoId: "14zH0q9psPM" },
  { category: "AI Storybook Studio", title: "Avoid Common Mistakes When Creating Storybook Images", videoId: "zUz0b1vqyqs" },
  { category: "AI Design Assistants", title: "How To Use The Mockup Creator", videoId: "hthvUeVA6Ns" },
  { category: "AI Design Assistants", title: "How To Use Product Photos Feature", videoId: "EOE3-zJ5pSE" },
  { category: "AI Design Assistants", title: "How To Use Character Creator Feature", videoId: "8v8_3nlZAOY" },
  { category: "AI Design Assistants", title: "How To Use AI Portrait In Airveek", videoId: "-dSGo-00H1E" },
  { category: "AI Design Assistants", title: "How To Use The AI Upscaler", videoId: "zL8LPyLOF1Y" },
  { category: "Kids Puzzles", title: "How To Create Word Search Puzzles", videoId: "l2X6QQiGOZ0" },
  { category: "Kids Puzzles", title: "How To Use The Maze Generator", videoId: "Axu0t1-tNEE" },
  { category: "Kids Puzzles", title: "How To Use Counting Numbers", videoId: "wizKHBw2g9c" },
  { category: "Consistent Characters", title: "How To Use Realistic Images", videoId: "P-1jwM9dq8Y" },
  { category: "Consistent Characters", title: "How To Use 3D and 2D Style Images", videoId: "qy0jdBgWeYU" },
  { category: "Consistent Characters", title: "How To Use Multi Consistent Characters", videoId: "JVLTbp4K2ao" },
  { category: "AI Art Illustrator", title: "How To Use AI Art Illustrator Feature", videoId: "r55TLAjr4zs" },
  { category: "AI Bulk Actions", title: "How To Use AI Bulk Action Feature", videoId: "pzOO8KgF76s" },
  { category: "My Flips Books", title: "How To Create a Flipbook Using Airveek AI", videoId: "TgXRxT7V2og" },
  { category: "Personal Designs", title: "How To Use Personal Designs Feature", videoId: "cSyy2PS0PEs" },
  { category: "Community Designs", title: "How To Use Community Designs Feature", videoId: "zVVZwT-LV6A" },
  { category: "Advanced AI Image Designer", title: "Advanced AI Image Editor", videoId: "mXlkkhKwyW4" },
  { category: "Advanced AI Image Designer", title: "How To Customize Templates With AI", videoId: "PfcQK39nWNQ" },
  { category: "Advanced AI Image Designer", title: "Using Mirror Magic To Recreate Any Image", videoId: "fpmVGvfJBBw" },
  { category: "Advanced AI Image Designer", title: "Instant Scene Background Editor", videoId: "cVsR6L7fdi0" },
  { category: "Advanced AI Image Designer", title: "Smart Image Expander: AI Outpainting", videoId: "m4kxyIElWKQ" },
  { category: "Advanced AI Image Designer", title: "How To Use AI Style Replicator", videoId: "0Jw14-ETO8g" },
  { category: "Customer Training", title: "AI Creates Ecom Mockups, Images, Logos, T-Shirt Designs & More", videoId: "eX821FVgB7I" },
  { category: "Customer Training", title: "Turn AI Designs, Logos, Mockups & Ads Into Revenue Machines", videoId: "nC4EtDnDpVI" },
  { category: "Customer Training", title: "How To Find Clients & Monetize AI Designs", videoId: "xVFPahR4uY4" },
  { category: "Customer Training", title: "Create & Sell Storybooks Using AI", videoId: "gZVSOM6apeA" },
  { category: "Customer Training", title: "Create Multilingual AI Books & Sell on Amazon KDP", videoId: "bv7eOBZaS5g" },
  { category: "Customer Training", title: "Create AI Books & Sell on Amazon KDP for Passive Income", videoId: "LwQsmjnkonc" },
  { category: "Customer Training", title: "Create Consistent Characters from One Image With Airveek", videoId: "m3_YrBYnYlI" },
  { category: "Customer Training", title: "Create Kids Storybooks With Just One Keyword", videoId: "hmHKucc9ago" },
  { category: "Customer Training", title: "Create Consistent Character Storybooks Fast With AI", videoId: "CjE0l1NFq44" },
  { category: "Customer Training", title: "Create High-Demand Digital Art With AI", videoId: "k4emNWUcXKk" },
  { category: "Customer Training", title: "Create & Sell Viral AI T-Shirts With Zero Budget", videoId: "M1c-eb5rRFs" },
  { category: "Customer Training", title: "How To Make Thumbnails, Ads & Banners With AI", videoId: "k51UPEA5rIo" },
  { category: "Customer Training", title: "Create Hot-Selling Kids Puzzle Books", videoId: "hUbWkUmxcJY" },
];

const categories = ["All tutorials", ...Array.from(new Set(tutorials.map((tutorial) => tutorial.category)))];

function VideoCard({ tutorial }: { tutorial: Tutorial }) {
  const thumbnail = `https://i.ytimg.com/vi/${tutorial.videoId}/hqdefault.jpg`;
  return (
    <article className="group overflow-hidden rounded-[1.35rem] border border-border bg-surface shadow-[0_18px_50px_rgba(var(--theme-shadow))] transition duration-300 hover:-translate-y-1 hover:border-primary/45">
      <a className="block" href={`https://www.youtube.com/watch?v=${tutorial.videoId}`} target="_blank" rel="noreferrer" aria-label={`Watch ${tutorial.title}`}>
        <div className="relative aspect-video overflow-hidden bg-media-stage">
          <Image src={thumbnail} alt="" fill sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover object-center transition duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040404]/90 via-[#040404]/10 to-transparent" aria-hidden="true" />
          <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/35 bg-black/70 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm">
            <Play className="h-3 w-3 fill-current text-primary" aria-hidden="true" /> Watch
          </span>
          <span className="absolute bottom-4 left-4 right-4 font-display text-xl font-bold leading-tight text-white sm:text-2xl">{tutorial.title}</span>
        </div>
      </a>
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{tutorial.category}</span>
        <a className="text-xs font-bold text-muted-foreground underline decoration-primary/30 underline-offset-4 transition hover:text-foreground" href={`https://www.youtube.com/watch?v=${tutorial.videoId}`} target="_blank" rel="noreferrer">Open video</a>
      </div>
    </article>
  );
}

function FeaturedVideo({ videoId }: { videoId: string }) {
  const [playing, setPlaying] = useState(false);
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  if (!playing) {
    return (
      <button type="button" className="group relative block aspect-video w-full overflow-hidden bg-black text-left" onClick={() => setPlaying(true)} aria-label="Play Airveek walkthrough">
        <Image src={thumbnail} alt="Airveek walkthrough video poster" fill sizes="(min-width: 1280px) 1120px, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" priority />
        <span className="absolute inset-0 bg-black/35 transition group-hover:bg-black/20" aria-hidden="true" />
        <span className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#0d120d] shadow-[0_10px_35px_rgba(0,0,0,0.25)]"><Play className="h-4 w-4 fill-current" aria-hidden="true" /> Play walkthrough</span>
      </button>
    );
  }
  return <iframe className="aspect-video w-full" src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`} title="Airveek walkthrough" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />;
}

export function TutorialsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All tutorials");
  const filtered = useMemo(() => tutorials.filter((tutorial) => {
    const matchesCategory = category === "All tutorials" || tutorial.category === category;
    const matchesQuery = !query.trim() || `${tutorial.title} ${tutorial.category}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  }), [category, query]);

  return (
    <InteriorPageShell>
      <InteriorHero eyebrow="Airveek learning hub" title="Learn faster. Create better." description="Explore practical tutorials for image generation, product visuals, storybooks, thumbnails, branding, and more. Pick a workflow, press play, and turn the idea into finished work." />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20" aria-labelledby="featured-tutorial">
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Start here</p>
            <h2 id="featured-tutorial" className="mt-2 font-display text-3xl font-extrabold text-foreground sm:text-4xl">Airveek walkthrough</h2>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-bold text-primary"><Sparkles className="h-4 w-4" aria-hidden="true" /> New workflows added regularly</span>
        </div>
        <div className="overflow-hidden rounded-[1.5rem] border border-primary/25 bg-media-stage p-2 shadow-[0_24px_80px_rgba(var(--theme-shadow))] sm:p-3">
          <div className="overflow-hidden rounded-[1.1rem] bg-black">
            <FeaturedVideo videoId="_Bi5QdWhfKE" />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:pb-28" aria-labelledby="tutorial-library">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Browse the library</p>
            <h2 id="tutorial-library" className="mt-2 font-display text-3xl font-extrabold text-foreground sm:text-4xl">Tutorials for the work you already do.</h2>
          </div>
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
            <label className="sr-only" htmlFor="tutorial-search">Search tutorials</label>
            <input id="tutorial-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tutorials" className="h-12 w-full rounded-full border border-input bg-surface pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-focus" />
          </div>
        </div>
        <div className="tutorial-category-scroll mb-9 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Tutorial categories">
          {categories.map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full border px-4 py-2.5 text-xs font-bold transition ${category === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>{item}</button>)}
        </div>
        {filtered.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((tutorial) => <VideoCard key={`${tutorial.category}-${tutorial.videoId}`} tutorial={tutorial} />)}</div> : <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center text-muted-foreground">No tutorials match that search. Try another keyword or category.</div>}
      </section>
    </InteriorPageShell>
  );
}
