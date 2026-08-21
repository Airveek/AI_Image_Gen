import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Airveek dashboard.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="brand-glow min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Image
            src="/images/airveek/logo.png"
            alt="Airveek"
            width={1881}
            height={358}
            className="h-auto w-[150px] sm:w-[190px]"
            priority
          />
          <LogoutButton />
        </header>

        <section className="mt-10 rounded-3xl border border-[#83ff00]/20 bg-[#0b120b]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-10" aria-labelledby="dashboard-title">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-[#83ff00]">Your workspace</p>
          <h1 id="dashboard-title" className="font-display text-4xl font-extrabold text-[#fdfdfd] sm:text-5xl">Welcome to Airveek</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#a4b19e]">You are signed in and ready to create. Your image generation workspace will appear here next.</p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#111a11] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f6f6f]">Signed in as</p>
            <p className="mt-2 break-all text-base font-semibold text-[#d9ffb8]">{user.email}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
