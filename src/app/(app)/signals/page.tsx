import { Suspense } from "react";
import { PageSignals } from "@/components/page-signals";

// PageSignals reads the ?mergeInsight= query param via useSearchParams(), which the App
// Router requires to be inside a Suspense boundary.
export default function SignalsPage() {
  return (
    <Suspense fallback={null}>
      <PageSignals />
    </Suspense>
  );
}
