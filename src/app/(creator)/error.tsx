"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function CreatorError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-red-400/20 bg-red-500/[0.04] p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-200" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-bold">The creator could not load</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Try the page again. If this continues, ask an administrator to check creator storage and provider settings.</p>
        <Button className="mt-6" type="button" variant="secondary" onClick={reset}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again</Button>
      </div>
    </div>
  );
}
