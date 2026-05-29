import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildGuidancePrompt,
  buildGuidanceResponse,
  mockGuidance,
  parseGuidanceRequest,
  type GuidanceResponse,
} from "@/features/guidance/guidance";

// USCIS form-field guidance endpoint.
//
// Given { formId, fieldLabel, situation } it returns
// { guidance, disclaimer, source } where `disclaimer` ALWAYS states this is
// general information, not legal advice, and that an attorney of record is
// required. The disclaimer is attached in buildGuidanceResponse — there is no
// code path that returns guidance without it.
//
// Graceful fallback: with no GEMINI_API_KEY (the default, secret-free build),
// we return deterministic templated guidance. With a key set, we call Gemini
// using a prompt that instructs the model to give general informational
// guidance only, never legal advice, and to recommend attorney review.

// Node runtime — the Google SDK is not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseGuidanceRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const req = parsed.value;

  const apiKey = process.env.GEMINI_API_KEY;

  // No key → templated informational fallback. Build stays fully secret-free.
  if (!apiKey) {
    const payload: GuidanceResponse = buildGuidanceResponse(
      mockGuidance(req),
      "mock",
    );
    return NextResponse.json(payload);
  }

  // Key present → call Gemini with the not-legal-advice prompt.
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const result = await model.generateContent(buildGuidancePrompt(req));
    const text = result.response.text();

    const guidance = text.trim() || mockGuidance(req);
    const payload: GuidanceResponse = buildGuidanceResponse(guidance, "gemini");
    return NextResponse.json(payload);
  } catch {
    // Model/network failure must still return safe, disclaimed guidance.
    const payload: GuidanceResponse = buildGuidanceResponse(
      mockGuidance(req),
      "mock",
    );
    return NextResponse.json(payload, { status: 200 });
  }
}
