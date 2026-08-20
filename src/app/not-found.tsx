import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-16">
      <section aria-labelledby="not-found-title">
        <p className="text-sm font-medium text-[#83ff00]">Airveek · 404</p>
        <h1
          id="not-found-title"
          className="mt-3 text-4xl font-semibold tracking-tight"
        >
          Page not found.
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-muted">
          The page you requested does not exist or may have moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-[#83ff00] px-5 py-3 text-sm font-semibold text-[#040404] transition-opacity hover:opacity-85"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
