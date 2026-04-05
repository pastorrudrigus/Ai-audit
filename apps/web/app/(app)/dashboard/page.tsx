import { Suspense } from "react";
import { Header } from "@/components/shared/header";
import { DashboardContent } from "./dashboard-content";
import { DashboardSkeleton } from "@/components/shared/loading-skeleton";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-6">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </main>
    </div>
  );
}
