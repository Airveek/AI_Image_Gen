"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3, LayoutDashboard, LineChart, LogOut, Plug, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const navigation = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/insights", label: "Insights", icon: BarChart3 },
  { href: "/admin/seo", label: "SEO control plane", icon: LineChart },
  { href: "/admin/integrations", label: "Integrations", icon: Plug },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar>
        <div className="flex h-20 items-center border-b border-white/10 px-6">
          <Link href="/admin" aria-label="Airveek admin overview">
            <Image src="/images/airveek/logo.png" alt="Airveek" width={1881} height={358} className="h-auto w-36" priority />
          </Link>
        </div>
        <div className="px-4 py-6">
          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-gray">Admin</p>
          <nav className="mt-3 space-y-1" aria-label="Admin navigation">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon",
                    active ? "bg-brand-neon/10 text-brand-soft" : "text-muted hover:bg-white/[0.05] hover:text-brand-white",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-white/10 p-4">
          <Link className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted transition-colors hover:bg-white/[0.05] hover:text-brand-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon" href="/">
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Back to website
          </Link>
        </div>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex min-h-20 items-center gap-4 border-b border-white/10 bg-brand-black/90 px-4 backdrop-blur-xl sm:px-6">
          <SidebarTrigger />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-neon">Airveek Admin</p>
            <p className="mt-1 text-sm text-muted">Manage your creative platform users</p>
          </div>
        </header>
        <main className="min-h-[calc(100vh-5rem)] bg-[#060806] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
