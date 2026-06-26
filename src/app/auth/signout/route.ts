import { NextResponse, type NextRequest } from "next/server";
import { revokeAndClearSession } from "@/lib/auth/session-cookie";

// Node runtime — firebase-admin (revokeRefreshTokens) is not Edge-safe.

export async function POST(request: NextRequest) {
  await revokeAndClearSession();
  return NextResponse.redirect(`${new URL(request.url).origin}/`, {
    status: 303,
  });
}
