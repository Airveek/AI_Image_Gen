import { Skeleton } from "@/components/ui/skeleton";

export default function CreatorLoading() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8" aria-label="Loading creator">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-5 h-12 w-full max-w-xl" />
      <Skeleton className="mt-4 h-6 w-full max-w-2xl" />
      <Skeleton className="mt-10 h-14 w-full max-w-2xl" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-72 rounded-2xl" />)}
      </div>
    </div>
  );
}
