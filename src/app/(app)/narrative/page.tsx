import { redirect } from "next/navigation";

// Narrative retired (design/storyline_handoff/) — permanent redirect. Not to be confused with
// the Futures page's own "narrative reader" modal, which is unrelated and unaffected.
export default function NarrativePage() {
  redirect("/futures");
}
