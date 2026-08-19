export function PromoBar() {
  return (
    <aside
      className="grid min-h-[74px] place-items-center bg-[linear-gradient(71deg,#c7208f,#6a14d1)] px-5 py-2.5 text-center text-[#fff254] max-[575px]:min-h-16 max-[575px]:px-3 max-[575px]:py-2 max-[375px]:py-[5px]"
      aria-label="Limited-time Artistly offer"
    >
      <p className="m-0 text-lg font-semibold leading-[1.5] max-[575px]:text-base max-[375px]:text-sm">
        <u>Unlimited Images:</u> $49 One-Time Payment!
        <br />
        <strong>Use Coupon &quot;SECRET10&quot; for 10% OFF!</strong>
      </p>
    </aside>
  );
}
