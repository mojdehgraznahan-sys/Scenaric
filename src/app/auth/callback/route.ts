// Email-confirmation landing route. Supabase's confirmation link (configured via
// emailRedirectTo in store.tsx's signUp call) points here with a `code` param;
// exchanging it establishes the real session before we hand off to onboarding.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}/login?confirmError=1`);
}
