import { Suspense } from "react";
import { PageMonitoring } from "@/components/page-monitoring";

// PageMonitoring reads the ?event= query param (Home's chart deep links) via
// useSearchParams(), which the App Router requires to be inside a Suspense boundary — see
// src/app/(app)/signals/page.tsx.
export default function MonitoringPage() {
  return (
    <Suspense fallback={null}>
      <PageMonitoring />
    </Suspense>
  );
}
