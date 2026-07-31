"use client";

import { Suspense } from "react";
import { PageMatrix } from "@/components/matrix/page-matrix";
import { useNavigate } from "@/lib/use-navigate";

// PageMatrix reads the ?focus= query param via useSearchParams(), which the App Router
// requires to be inside a Suspense boundary — see src/app/(app)/signals/page.tsx.
export default function MatrixPage() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={null}>
      <PageMatrix navigate={navigate} />
    </Suspense>
  );
}
