"use client";

import { PageMatrix } from "@/components/matrix/page-matrix";
import { useNavigate } from "@/lib/use-navigate";

export default function MatrixPage() {
  const navigate = useNavigate();
  return <PageMatrix navigate={navigate} />;
}
