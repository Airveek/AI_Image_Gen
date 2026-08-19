const stack = [
  ["Framework", "Next.js App Router"],
  ["Language", "TypeScript"],
  ["Styling", "Tailwind CSS"],
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 sm:px-10 lg:px-16">
      <section aria-labelledby="page-title" className="w-full">
        <p className="mb-5 inline-flex rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium text-muted shadow-sm">
          Project foundation ready
        </p>

        <h1
          id="page-title"
          className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
        >
          Artistly is ready to build.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
          A clean foundation for an AI-powered creative experience, built with
          modern Next.js, TypeScript, and Tailwind CSS.
        </p>

        <dl className="mt-12 grid gap-4 sm:grid-cols-3">
          {stack.map(([term, description]) => (
            <div
              key={term}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
            >
              <dt className="text-sm font-medium text-muted">{term}</dt>
              <dd className="mt-2 text-base font-semibold">{description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
