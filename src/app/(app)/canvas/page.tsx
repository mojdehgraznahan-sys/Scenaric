import { redirect } from "next/navigation";

// Canvas retired (design/storyline_handoff/) — permanent redirect.
export default function CanvasPage() {
  redirect("/futures");
}
