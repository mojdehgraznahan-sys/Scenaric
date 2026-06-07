import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/toaster";

// Logged-in app shell wraps every (app) route with the sidenav/topbar chrome.
// StoreProvider lives in the root layout so auth/onboarding can use it too.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <Toaster />
    </>
  );
}
