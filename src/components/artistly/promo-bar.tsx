export function PromoBar() {
  return (
    <aside
      className="relative z-30 grid min-h-12 place-items-center overflow-hidden bg-[linear-gradient(100deg,#2ac414,#83ff00_48%,#2ac414)] px-4 py-2 text-center text-[#040404] sm:min-h-14"
      aria-label="Limited-time Artistly offer"
    >
      <p className="m-0 text-xs font-semibold leading-5 sm:text-sm">
        <span className="font-black">Unlimited Images: $49 One-Time Payment!</span>
        <span className="mx-2 hidden text-[#040404]/40 sm:inline">•</span>
        <strong>Use Coupon &quot;SECRET10&quot; for 10% OFF!</strong>
      </p>
    </aside>
  );
}
