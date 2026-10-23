import { redirect } from "next/navigation";

// Event chains merged into Storyline (design/storyline_handoff/) — permanent redirect.
export default function ChainsPage() {
  redirect("/storyline");
}
