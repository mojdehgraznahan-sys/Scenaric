import { Suspense } from "react";
import { PageStrategy } from "@/components/page-strategy";

// PageStrategy reads the ?scenarioId= query param via useSearchParams(), which the App
// Router requires to be inside a Suspense boundary — see src/app/(app)/signals/page.tsx.
export default function StrategyPage() {
  return (
    <Suspense fallback={null}>
      <PageStrategy />
    </Suspense>
  );
}
