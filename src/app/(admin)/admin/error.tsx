"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center text-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-danger">Admin panel error</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-foreground">The user data could not be loaded.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Check the Supabase connection and try again.</p>
        <Button className="mt-6" onClick={reset} type="button" variant="primary">Try again</Button>
      </div>
    </div>
  );
}
