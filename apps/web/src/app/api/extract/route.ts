import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extractProfileFromUrl } from "@/lib/onboarding/extract-profile";
import { FetchSiteError } from "@/lib/scrape/fetch-site";
import { LlmError } from "@/lib/llm";
import { handleRouteError, jsonError } from "@/lib/http";

// Uses node:dns + streaming fetch — requires the Node.js runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ website: z.string().url() });

/** POST /api/extract — auto-derive Tier-3 profile fields from a website URL. */
export async function POST(req: NextRequest) {
  try {
    const { website } = Body.parse(await req.json());
    const profile = await extractProfileFromUrl(website);
    return NextResponse.json(profile);
  } catch (err) {
    if (err instanceof FetchSiteError) {
      return jsonError(422, `Could not read that website: ${err.message}`);
    }
    if (err instanceof LlmError) {
      return jsonError(502, "The analysis model is unavailable. Try again.");
    }
    return handleRouteError("api/extract", err);
  }
}
