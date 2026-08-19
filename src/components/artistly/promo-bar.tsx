export function PromoBar() {
  return (
    <aside
      className="relative z-30 grid min-h-12 place-items-center overflow-hidden bg-[linear-gradient(100deg,#8b1bb5,#4b20b9_48%,#d84473)] px-4 py-2 text-center text-white sm:min-h-14"
      aria-label="Limited-time Artistly offer"
    >
      <p className="m-0 text-xs font-semibold leading-5 sm:text-sm">
        <span className="font-black text-yellow-200">Unlimited Images: $49 One-Time Payment!</span>
        <span className="mx-2 hidden text-white/50 sm:inline">•</span>
        <strong className="text-white">Use Coupon &quot;SECRET10&quot; for 10% OFF!</strong>
      </p>
    </aside>
  );
}
