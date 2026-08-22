import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return <div className="mx-auto max-w-7xl space-y-6"><Skeleton className="h-24 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><Skeleton className="h-96 w-full" /></div>;
}
