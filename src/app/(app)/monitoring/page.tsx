import { Suspense } from "react";
import { PageMonitoring } from "@/components/page-monitoring";

// PageMonitoring reads the ?scenarioId= query param via useSearchParams(), which the App
// Router requires to be inside a Suspense boundary — see src/app/(app)/signals/page.tsx.
export default function MonitoringPage() {
  return (
    <Suspense fallback={null}>
      <PageMonitoring />
    </Suspense>
  );
}
