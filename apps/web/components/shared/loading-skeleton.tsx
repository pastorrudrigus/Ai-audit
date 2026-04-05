import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Skeleton className="h-72 rounded-lg" />
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}
