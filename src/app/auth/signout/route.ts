import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/firebase/config";

export async function POST(request: NextRequest) {
  // Clear the Firebase session cookie (no-op if absent).
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.redirect(`${new URL(request.url).origin}/`, {
    status: 303,
  });
}
