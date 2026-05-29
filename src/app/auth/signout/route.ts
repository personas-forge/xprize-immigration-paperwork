import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  if (isAuthConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(`${new URL(request.url).origin}/`, {
    status: 303,
  });
}
