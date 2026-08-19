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
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] transition duration-200 hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.09]">
      <div className="relative aspect-[1.35] overflow-hidden bg-slate-900">
        <Image
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          src={artwork.src}
          alt={artwork.alt}
          width={artwork.width}
          height={artwork.height}
          sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050b2b]/80 via-transparent to-transparent" />
        {feature.tag ? <span className="absolute left-4 top-4 rounded-full bg-cyan-300 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-950">{feature.tag}</span> : null}
      </div>
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300/20 to-fuchsia-400/20 text-cyan-200">
            <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h3 className="font-display text-xl font-bold text-white">{feature.title}</h3>
        </div>
        <p className="m-0 text-sm leading-6 text-slate-300">{feature.description}</p>
      </div>
    </article>
  );
}
