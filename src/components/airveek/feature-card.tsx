import Image from "next/image";
import type { Feature } from "./landing-data";
import { artworks } from "./landing-data";

type FeatureCardProps = {
  feature: Feature;
};

export function FeatureCard({ feature }: FeatureCardProps) {
  const Icon = feature.icon;
  const artwork = artworks[feature.imageIndex % artworks.length];

  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] transition duration-200 hover:-translate-y-1 hover:border-[#83ff00]/50 hover:bg-[#83ff00]/[0.06]">
      <div className="relative aspect-[1.35] overflow-hidden bg-[#0b120b]">
        <Image
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          src={artwork.src}
          alt={artwork.alt}
          width={artwork.width}
          height={artwork.height}
          sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#040404]/85 via-transparent to-transparent" />
        {feature.tag ? <span className="absolute left-4 top-4 rounded-full bg-[#83ff00] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#040404]">{feature.tag}</span> : null}
      </div>
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#83ff00]/20 to-[#2ac414]/20 text-[#83ff00]">
            <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h3 className="font-display text-xl font-bold text-[#fdfdfd]">{feature.title}</h3>
        </div>
        <p className="m-0 text-sm leading-6 text-[#a4b19e]">{feature.description}</p>
      </div>
    </article>
  );
}
