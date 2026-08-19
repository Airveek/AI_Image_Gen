"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-16">
      <section aria-labelledby="error-title">
        <p className="text-sm font-medium text-muted">Something went wrong</p>
        <h1
          id="error-title"
          className="mt-3 text-4xl font-semibold tracking-tight"
        >
          We could not load this page.
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-muted">
          Please try again. If the problem continues, return later.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
